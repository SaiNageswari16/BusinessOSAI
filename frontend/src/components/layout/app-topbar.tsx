import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, MessageSquare, LogOut,
  ChevronDown, Building2, ShieldCheck, ShieldAlert, Globe, Coins,
  Component, Archive, Layers, Terminal, ShoppingCart,
  ShoppingBag, Receipt, UsersRound, BarChart3, Settings,
  LayoutDashboard, RadioTower, ExternalLink, Trash2,
  CheckCheck, Search, Filter, Clock, Sparkles, Inbox, Plus, Check,
  Eye, X, ArrowRight, Send, Megaphone, Bot, MessageCircle, Calculator,
  SlidersHorizontal, Menu, Share2, KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/auth-context";
import { useTenant } from "@/contexts/tenant-context";
import { useRbac } from "@/contexts/rbac-context";
import { useI18n, LANGUAGE_LABELS } from "@/contexts/i18n-context";
import { notifications } from "@/data/mock";
import { nav } from "@/data/navigation";
import { CommandPalette } from "@/components/command-palette";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { cn, AVAILABLE_CURRENCIES, getActiveCurrency, setActiveCurrency } from "@/lib/utils";
import { liveNotificationsApi, LiveNotification, copilotApi, pushNotificationsApi, employeesApi, NotificationBroadcast } from "@/lib/api-client";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { WhatsAppStatusIndicator } from "./WhatsAppStatusIndicator";
import { Hash, User as UserIcon, Loader2, AlertCircle, Tag, RefreshCw } from "lucide-react";

const moduleDisplayList = [
  {
    id: "dashboard",
    group: "Workspace",
    label: "Dashboard",
    icon: LayoutDashboard,
    defaultTo: "/dashboard",
    permission: "view:dashboard",
    activeText: "text-purple-700",
    activeBg: "bg-purple-50/90",
    hoverText: "group-hover:text-purple-700",
    hoverBg: "hover:bg-purple-50/50",
    indicator: "bg-purple-700",
  },
  {
    id: "erp",
    group: "Core ERP",
    label: "ORG Profile",
    icon: Component,
    defaultTo: "/erp?tab=companies",
    permission: "view:erp",
    activeText: "text-purple-700",
    activeBg: "bg-purple-50/90",
    hoverText: "group-hover:text-purple-700",
    hoverBg: "hover:bg-purple-50/50",
    indicator: "bg-purple-700",
  },
  {
    id: "inventory",
    group: "Inventory & Warehouse",
    label: "Inventory",
    icon: Archive,
    defaultTo: "/inventory?tab=products",
    permission: "view:inventory",
    activeText: "text-purple-700",
    activeBg: "bg-purple-50/90",
    hoverText: "group-hover:text-purple-700",
    hoverBg: "hover:bg-purple-50/50",
    indicator: "bg-purple-700",
  },
  {
    id: "operations",
    group: "Purchase",
    label: "Purchase",
    icon: ShoppingBag,
    defaultTo: "/procurement?tab=vendor_bills",
    permission: "view:procurement",
    activeText: "text-purple-700",
    activeBg: "bg-purple-50/90",
    hoverText: "group-hover:text-purple-700",
    hoverBg: "hover:bg-purple-50/50",
    indicator: "bg-purple-700",
  },
  {
    id: "pos",
    group: "Sales",
    label: "Sales",
    icon: Terminal,
    defaultTo: "/pos?tab=sales_history",
    permission: "view:pos",
    activeText: "text-purple-700",
    activeBg: "bg-purple-50/90",
    hoverText: "group-hover:text-purple-700",
    hoverBg: "hover:bg-purple-50/50",
    indicator: "bg-purple-700",
  },
  {
    id: "crm",
    group: "CRM",
    label: "CRM",
    icon: ShoppingCart,
    defaultTo: "/crm?tab=customers",
    permission: "view:crm",
    activeText: "text-purple-700",
    activeBg: "bg-purple-50/90",
    hoverText: "group-hover:text-purple-700",
    hoverBg: "hover:bg-purple-50/50",
    indicator: "bg-purple-700",
  },
  {
    id: "social_media",
    group: "Social Media",
    label: "Digital Marketing",
    icon: Share2,
    defaultTo: "/social?tab=dashboard",
    permission: "view:social_media",
    activeText: "text-purple-700",
    activeBg: "bg-purple-50/90",
    hoverText: "group-hover:text-purple-700",
    hoverBg: "hover:bg-purple-50/50",
    indicator: "bg-purple-700",
  },
  {
    id: "marketplace",
    group: "Marketplace",
    label: "Marketplace",
    icon: ShoppingBag,
    defaultTo: "/marketplace?tab=vendors",
    permission: "view:marketplace",
    activeText: "text-purple-700",
    activeBg: "bg-purple-50/90",
    hoverText: "group-hover:text-purple-700",
    hoverBg: "hover:bg-purple-50/50",
    indicator: "bg-purple-700",
  },
  {
    id: "accounting",
    group: "Accounting & Finance",
    label: "Accounting",
    icon: Calculator,
    defaultTo: "/accounting?tab=customers",
    permission: "view:accounting",
    activeText: "text-purple-700",
    activeBg: "bg-purple-50/90",
    hoverText: "group-hover:text-purple-700",
    hoverBg: "hover:bg-purple-50/50",
    indicator: "bg-purple-700",
  },
  {
    id: "hrms",
    group: "HRMS",
    label: "HRMS",
    icon: UsersRound,
    defaultTo: "/hrms?tab=employees",
    permission: "view:hrms",
    activeText: "text-purple-700",
    activeBg: "bg-purple-50/90",
    hoverText: "group-hover:text-purple-700",
    hoverBg: "hover:bg-purple-50/50",
    indicator: "bg-purple-700",
  },
  {
    id: "iot",
    group: "IoT",
    label: "IoT",
    icon: RadioTower,
    defaultTo: "/iot?tab=connected_devices",
    permission: "view:iot",
    activeText: "text-purple-700",
    activeBg: "bg-purple-50/90",
    hoverText: "group-hover:text-purple-700",
    hoverBg: "hover:bg-purple-50/50",
    indicator: "bg-purple-700",
  },
  {
    id: "analytics",
    group: "Reports",
    label: "Analytics",
    icon: BarChart3,
    defaultTo: "/reports?tab=sales_reports",
    permission: "view:reports",
    activeText: "text-purple-700",
    activeBg: "bg-purple-50/90",
    hoverText: "group-hover:text-purple-700",
    hoverBg: "hover:bg-purple-50/50",
    indicator: "bg-purple-700",
  },
  {
    id: "report_builder",
    group: "Report Builder",
    label: "Report Builder",
    icon: SlidersHorizontal,
    defaultTo: "/reports?tab=custom_reports",
    permission: "view:reports",
    activeText: "text-purple-700",
    activeBg: "bg-purple-50/90",
    hoverText: "group-hover:text-purple-700",
    hoverBg: "hover:bg-purple-50/50",
    indicator: "bg-purple-700",
  },
  {
    id: "settings",
    group: "System Configuration",
    label: "System Config",
    icon: Settings,
    defaultTo: "/settings?tab=company_profile",
    permission: "view:system_config",
    activeText: "text-purple-700",
    activeBg: "bg-purple-50/90",
    hoverText: "group-hover:text-purple-700",
    hoverBg: "hover:bg-purple-50/50",
    indicator: "bg-purple-700",
  },
];

const renderCompanyLogo = (logo?: string | null, name?: string, sizeClass = "size-3") => {
  if (!logo) {
    return <Building2 className={sizeClass} />;
  }
  const isImage = typeof logo === "string" && (
    logo.startsWith("data:image/") ||
    logo.startsWith("http://") ||
    logo.startsWith("https://") ||
    logo.startsWith("/") ||
    logo.startsWith("blob:")
  );
  if (isImage) {
    return <img src={logo} alt={name || "Workspace Logo"} className="w-full h-full object-cover rounded-md" />;
  }
  if (typeof logo === "string" && logo.length <= 4) {
    return <span className="text-[10px] font-black leading-none">{logo}</span>;
  }
  const initials = (name || "CO")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "CO";
  return <span className="text-[10px] font-black leading-none">{initials}</span>;
};

export function AppTopbar({
  onCollapseToggle,
  isSidebarCollapsed = false,
  isMobileOpen = false,
  onMobileToggle,
}: {
  onCollapseToggle?: () => void;
  isSidebarCollapsed?: boolean;
  isMobileOpen?: boolean;
  onMobileToggle?: () => void;
} = {}) {
  const { currency } = useCurrency();
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const {
    tenant,
    tenant: company,
    setTenant: setCompany,
    companiesList,
  } = useTenant();
  const { activeRole, availableRoles, setActiveRole, hasPermission, isModuleAllowed } = useRbac();
  const navigate = useNavigate();
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [activeCurrency, setActiveCurrencyState] = useState(getActiveCurrency());
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isPlatformSuperAdmin = Boolean(user?.isPlatformAdmin);
  const isTenantOwner = Boolean(user?.isTenantOwner);
  const canSwitchWorkspaces = isPlatformSuperAdmin || isTenantOwner || user?.canSwitchWorkspaces !== false;
  const isSwitcherAvailable = canSwitchWorkspaces && companiesList.length >= 1;

  // Filter modules to only those the current user has permission to access AND is allowed in workspace
  const visibleModules = useMemo(() => {
    return moduleDisplayList.filter((mod) => {
      if (!isModuleAllowed(mod.id)) return false;
      if (mod.permission && !hasPermission(mod.permission)) return false;
      return true;
    });
  }, [isModuleAllowed, hasPermission]);

  const handleCurrencySelect = (code: string) => {
    setActiveCurrency(code);
    setActiveCurrencyState(getActiveCurrency());
  };

  useEffect(() => {
    const handleCurrencyChanged = () => {
      setActiveCurrencyState(getActiveCurrency());
    };
    window.addEventListener("bos-currency-changed", handleCurrencyChanged);
    return () => window.removeEventListener("bos-currency-changed", handleCurrencyChanged);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [liveNotifications, setLiveNotifications] = useState<LiveNotification[]>([]);
  const [selectedNotif, setSelectedNotif] = useState<any | null>(null);
  const [centerOpen, setCenterOpen] = useState(false);
  const [notifFilterCategory, setNotifFilterCategory] = useState<string>("all");
  const [notifSearchQuery, setNotifSearchQuery] = useState<string>("");

  // Messages Center State
  const [activeMessageTab, setActiveMessageTab] = useState<"team" | "broadcasts" | "assistant">("team");
  const [selectedThreadId, setSelectedThreadId] = useState<string>("c-general");
  const [messageInput, setMessageInput] = useState("");
  const [messageTag, setMessageTag] = useState<string>("Normal");
  const [aiAssistantInput, setAiAssistantInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiChatHistory, setAiChatHistory] = useState<Array<{ sender: "user" | "ai"; text: string; time: string }>>([
    {
      sender: "ai",
      text: "👋 Hello! I am your BusinessOS Enterprise AI Copilot. Ask me anything about stock movement, standard GST invoices, POS reconciliation, or customer sales returns.",
      time: "Just now"
    }
  ]);

  // Persistent Team Chat Channels & Colleague Directory
  const currentTenantId = (tenant as any)?.raw?.tenant_id || (tenant as any)?.tenant_id || tenant?.id || "default";
  const currentCompanyId = tenant?.id || (tenant as any)?.raw?.id || (tenant as any)?.company_id || "default";
  const chatStorageKey = `bos_team_chat_${currentTenantId}_${currentCompanyId}`;

  const defaultTeamChannels = useMemo(() => [
    {
      id: "c-general",
      name: "general",
      title: "General & All-Hands",
      desc: "Company-wide updates & general team coordination",
      avatar: "📢",
      unread: 0,
      isChannel: true,
    },
    {
      id: "c-operations",
      name: "operations-logistics",
      title: "Operations & Logistics",
      desc: "Warehouse stock transfers, goods receipts & dispatch",
      avatar: "📦",
      unread: 0,
      isChannel: true,
    },
    {
      id: "c-sales",
      name: "sales-billing-pos",
      title: "Sales Counter & POS",
      desc: "Counter billing, customer orders, registers & discounts",
      avatar: "🧾",
      unread: 0,
      isChannel: true,
    },
    {
      id: "c-accounts",
      name: "finance-accounts",
      title: "Finance & Accounts",
      desc: "Tax invoices, ledger reconciliations, credit notes & payments",
      avatar: "💳",
      unread: 0,
      isChannel: true,
    },
  ], []);

  const [teamMessages, setTeamMessages] = useState<Record<string, Array<{
    id: string;
    sender: string;
    role: string;
    text: string;
    time: string;
    isSelf: boolean;
    tag?: string;
  }>>>({});

  const [colleagues, setColleagues] = useState<Array<{ id: string; name: string; role: string; email?: string }>>([]);

  // Load team messages from localStorage & sync across windows
  useEffect(() => {
    try {
      const raw = localStorage.getItem(chatStorageKey);
      if (raw) {
        setTeamMessages(JSON.parse(raw));
      } else {
        const initial = {
          "c-general": [
            {
              id: "init-1",
              sender: "System Administrator",
              role: "Admin HQ",
              text: `Welcome to ${tenant.name || "the workspace"} communications hub. All workspace team coordination and urgent notices are synced here.`,
              time: "09:00 AM",
              isSelf: false,
              tag: "Notice",
            }
          ],
          "c-operations": [
            {
              id: "init-2",
              sender: "Logistics Team",
              role: "Warehouse Operations",
              text: "Stock transfers between store and central warehouse are active. Please ensure GRN is verified on arrival.",
              time: "09:30 AM",
              isSelf: false,
              tag: "Logistics",
            }
          ],
          "c-sales": [
            {
              id: "init-3",
              sender: "Counter Lead",
              role: "Store POS Counter",
              text: "Counter terminals are active. Remember to verify customer GSTIN when issuing B2B tax invoices.",
              time: "10:00 AM",
              isSelf: false,
              tag: "Billing",
            }
          ],
          "c-accounts": [
            {
              id: "init-4",
              sender: "Accounts Desk",
              role: "Finance",
              text: "Daily sales collections and credit notes can be reconciled under POS Invoices History and Tax Reports.",
              time: "10:15 AM",
              isSelf: false,
              tag: "Accounts",
            }
          ],
        };
        setTeamMessages(initial);
        localStorage.setItem(chatStorageKey, JSON.stringify(initial));
      }
    } catch (e) {}

    // Fetch team colleagues from employeesApi
    employeesApi.list(1, 100, undefined, tenant?.id).then((res: any) => {
      const emps = res?.items || (Array.isArray(res) ? res : []);
      if (Array.isArray(emps) && emps.length > 0) {
        setColleagues(emps.map((e: any) => ({
          id: `dm-${e.id}`,
          name: e.full_name || e.name || "Team Member",
          role: e.designation || e.department || "Colleague",
          email: e.email,
        })));
      }
    }).catch(() => {});

    const handleStorage = (e: StorageEvent) => {
      if (e.key === chatStorageKey && e.newValue) {
        try {
          setTeamMessages(JSON.parse(e.newValue));
        } catch {}
      }
    };
    const handleChatSync = () => {
      try {
        const raw = localStorage.getItem(chatStorageKey);
        if (raw) setTeamMessages(JSON.parse(raw));
      } catch {}
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("bos_team_chat_sync", handleChatSync);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("bos_team_chat_sync", handleChatSync);
    };
  }, [chatStorageKey, tenant?.id, tenant.name]);

  // Live Broadcasts / Notices State
  const [broadcasts, setBroadcasts] = useState<NotificationBroadcast[]>([]);
  const [isLoadingBroadcasts, setIsLoadingBroadcasts] = useState(false);
  const [isPostingNotice, setIsPostingNotice] = useState(false);
  const [newNoticeTitle, setNewNoticeTitle] = useState("");
  const [newNoticeBody, setNewNoticeBody] = useState("");
  const [newNoticeCategory, setNewNoticeCategory] = useState("notice");
  const [isSubmittingNotice, setIsSubmittingNotice] = useState(false);

  const loadBroadcasts = async () => {
    setIsLoadingBroadcasts(true);
    try {
      const data = await pushNotificationsApi.listBroadcasts(50);
      if (Array.isArray(data)) {
        setBroadcasts(data);
      }
    } catch (err) {
      console.warn("Failed to load broadcasts:", err);
    } finally {
      setIsLoadingBroadcasts(false);
    }
  };

  useEffect(() => {
    loadBroadcasts();
  }, [tenant?.id]);

  const fetchLiveNotifications = async (isFirst = false) => {
    try {
      const data = await liveNotificationsApi.list();
      setLiveNotifications((prev) => {
        if (!isFirst && data.length > 0) {
          const prevIds = new Set(prev.map((n) => n.id));
          const newUnread = data.filter((n) => n.unread && !prevIds.has(n.id));

          newUnread.forEach((n) => {
            toast.info(n.title, {
              description: n.body,
              duration: 5000,
            });
          });
        }
        return data;
      });
    } catch (err) {
      console.error("Failed to pull live notifications:", err);
    }
  };

  useEffect(() => {
    fetchLiveNotifications(true);
    // Poll for notifications every 12 seconds
    const interval = setInterval(() => {
      fetchLiveNotifications(false);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageInput.trim() || !selectedThreadId) return;

    const newMsgText = messageInput.trim();
    setMessageInput("");

    const myName = user?.name || (user as any)?.fullName || (user?.email ? user.email.split('@')[0] : "You");
    const myRole = activeRole?.name || "Manager";
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg = {
      id: `msg-${Date.now()}`,
      sender: myName,
      role: myRole,
      text: newMsgText,
      time: nowTime,
      isSelf: true,
      tag: messageTag !== "Normal" ? messageTag : undefined,
    };

    setTeamMessages((prev) => {
      const existing = prev[selectedThreadId] || [];
      const updated = {
        ...prev,
        [selectedThreadId]: [...existing, newMsg]
      };
      try {
        localStorage.setItem(chatStorageKey, JSON.stringify(updated));
        window.dispatchEvent(new Event("bos_team_chat_sync"));
      } catch (err) {}
      return updated;
    });

    toast.success("Message dispatched to team channel");
  };

  const handlePublishNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoticeTitle.trim() || !newNoticeBody.trim()) {
      toast.error("Please provide both notice title and message body.");
      return;
    }

    setIsSubmittingNotice(true);
    try {
      const res = await pushNotificationsApi.sendBroadcast({
        title: newNoticeTitle.trim(),
        body: newNoticeBody.trim(),
        category: newNoticeCategory,
        target_type: "all_org",
        channels: ["in_app", "web_push"]
      });

      toast.success(res?.message || "Notice published to all workspace members!");
      setNewNoticeTitle("");
      setNewNoticeBody("");
      setIsPostingNotice(false);
      await loadBroadcasts();
      void fetchLiveNotifications();
    } catch (err: any) {
      toast.error(err?.message || "Failed to broadcast notice.");
    } finally {
      setIsSubmittingNotice(false);
    }
  };

  const handleSendAiAssistant = async (queryText?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = (queryText || aiAssistantInput).trim();
    if (!query || isAiLoading) return;

    setAiAssistantInput("");
    const userMsg = { sender: "user" as const, text: query, time: "Just now" };

    setAiChatHistory((prev) => [...prev, userMsg]);
    setIsAiLoading(true);

    try {
      // Build history for backend AI Copilot
      const historyPayload = aiChatHistory.slice(-8).map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text,
      }));

      const res = await copilotApi.chat(query, historyPayload);
      const reply = res?.reply || "I am connected to your workspace data and ready to assist with sales, inventory, or billing.";

      setAiChatHistory((prev) => [
        ...prev,
        {
          sender: "ai",
          text: reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err: any) {
      setAiChatHistory((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "I experienced an error connecting to the Copilot AI engine. Please verify backend service availability or try again in a moment.",
          time: "Just now"
        }
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await liveNotificationsApi.readAll();
      setLiveNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
      toast.success("All notifications marked as read!");
    } catch (err) {
      toast.error("Failed to mark notifications as read");
    }
  };

  const handleSelectNotification = async (notif: any) => {
    setSelectedNotif(notif);
    if (notif.unread) {
      try {
        await liveNotificationsApi.markAsRead(notif.id);
        setLiveNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, unread: false } : n));
      } catch (err) {
        // Fallback local update
        setLiveNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, unread: false } : n));
      }
    }
  };

  const handleDeleteNotification = async (notifId: string | number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await liveNotificationsApi.delete(String(notifId));
      setLiveNotifications(prev => prev.filter(n => n.id !== notifId));
      if (selectedNotif?.id === notifId) setSelectedNotif(null);
      toast.success("Notification dismissed");
    } catch (err) {
      setLiveNotifications(prev => prev.filter(n => n.id !== notifId));
      if (selectedNotif?.id === notifId) setSelectedNotif(null);
    }
  };

  const getActionRoute = (notif: any): { url: string; label: string } | null => {
    const text = `${notif.title || ''} ${notif.body || ''}`.toLowerCase();
    if (text.includes("lead") || text.includes("crm lead")) return { url: "/crm?tab=leads", label: "Open CRM Leads" };
    if (text.includes("opportunity") || text.includes("deal")) return { url: "/crm?tab=opportunities", label: "Open Deals" };
    if (text.includes("attendance") || text.includes("punch")) return { url: "/hrms?tab=ess_attendance", label: "Open Attendance" };
    if (text.includes("commission") || text.includes("payroll")) return { url: "/hrms?tab=commissions", label: "Open Commissions" };
    if (text.includes("order") || text.includes("invoice")) return { url: "/crm?tab=orders", label: "Open Sales Orders" };
    if (text.includes("inventory") || text.includes("batch") || text.includes("stock")) return { url: "/inventory?tab=batches", label: "Open Inventory" };
    if (text.includes("pos") || text.includes("register")) return { url: "/pos", label: "Open POS Register" };
    return { url: "/settings?tab=company_profile", label: "Open Workspace Settings" };
  };

  const handleNavigateFromNotif = (notif: any) => {
    const action = getActionRoute(notif);
    if (action) {
      setSelectedNotif(null);
      setCenterOpen(false);
      handleNavigateModule(action.url);
    }
  };

  const activeNotifs = liveNotifications.length > 0 ? liveNotifications : notifications.map(n => ({
    id: n.id,
    title: n.title,
    body: n.body,
    unread: n.unread,
    created_at: new Date(Date.now() - 600000).toISOString(),
    category: "system"
  }));

  const unreadCount = activeNotifs.filter((n) => n.unread).length;

  // Determine active group based on current URL
  const currentPath = location.pathname;
  const currentPathWithSearch = location.href;

  const currentActiveGroup = useMemo(() => {
    for (const group of nav) {
      for (const item of group.items) {
        if (item.subItems) {
          for (const sub of item.subItems) {
            if (currentPathWithSearch.includes(sub.to)) return group.group;
          }
        }
        if (currentPathWithSearch.includes(item.to)) return group.group;
      }
    }
    for (const group of nav) {
      for (const item of group.items) {
        if (item.to.startsWith(currentPath) || (item.subItems && item.subItems.some(s => s.to.startsWith(currentPath)))) {
          return group.group;
        }
      }
    }
    return visibleModules[0]?.group || "Core ERP";
  }, [currentPath, currentPathWithSearch, visibleModules]);

  const handleNavigateModule = (defaultTo: string) => {
    const [path, searchStr] = defaultTo.split("?");
    const search: Record<string, string> = {};
    if (searchStr) {
      const params = new URLSearchParams(searchStr);
      params.forEach((value, key) => {
        search[key] = value;
      });
    }
    void navigate({ to: path, search });
  };

  return (
    <header className="sticky top-0 z-50 flex h-[58px] shrink-0 items-center justify-between border-b border-slate-200/90 bg-white px-2 lg:px-3.5 shadow-xs select-none no-print w-full overflow-hidden">
      {/* ── Left: Mobile Hamburger (< lg) & LazyMonkeyAI Brand Logo ── */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 mr-1 xl:mr-2">
        {/* Mobile / Tablet Menu Trigger (Visible on screens < lg) */}
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:text-purple-700 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Open Navigation Menu"
        >
          <Menu className="size-5" />
        </button>

        <div
          onClick={() => {
            const firstAllowed = visibleModules[0]?.defaultTo || "/dashboard";
            handleNavigateModule(firstAllowed);
          }}
          className="flex items-center cursor-pointer group shrink-0"
        >
          <img
            src="/Logo.png"
            alt="IoTRONCS"
            className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
          />
        </div>
      </div>

      {/* ── Center: Top Modules Navigation Ribbon (Zero scroll, perfectly flex-fitted, filtered by permission) ── */}
      <div
        onMouseLeave={() => setHoveredModule(null)}
        className="hidden lg:flex items-center justify-center flex-1 h-full px-0.5 min-w-0 overflow-hidden"
      >
        {visibleModules.map((mod) => {
          const isActive = currentActiveGroup === mod.group;
          const isHovered = hoveredModule === mod.group;
          const Icon = mod.icon;
          return (
            <motion.button
              key={mod.group}
              whileTap={{ scale: 0.94 }}
              onMouseEnter={() => setHoveredModule(mod.group)}
              onClick={() => handleNavigateModule(mod.defaultTo)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 flex-1 min-w-0 max-w-[82px] xl:max-w-[90px] h-full px-1 transition-colors whitespace-nowrap cursor-pointer group z-10",
                isActive
                  ? `${mod.activeText} font-extrabold`
                  : `text-slate-600 ${mod.hoverText} font-bold`
              )}
            >
              {/* Active Tab Background */}
              {isActive && (
                <motion.div
                  layoutId="activeTopbarModuleBg"
                  className="absolute inset-0 bg-purple-50/90 rounded-b-md -z-10 shadow-2xs"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}

              {/* Hover Backdrop Aura */}
              {isHovered && !isActive && (
                <motion.div
                  layoutId="hoverTopbarModuleBg"
                  className="absolute inset-0 bg-slate-100/70 rounded-b-md -z-10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}

              <Icon
                className={cn(
                  "size-[18px] xl:size-[20px] transition-transform shrink-0",
                  isActive ? `${mod.activeText} stroke-[2.4] scale-105` : `text-slate-500 stroke-[1.8] ${mod.hoverText} group-hover:scale-105`
                )}
              />
              <span className={cn(
                "tracking-tight leading-none text-[11px] xl:text-[12px] truncate max-w-full text-center transition-colors",
                isActive ? `font-extrabold ${mod.activeText}` : `font-bold text-slate-700 ${mod.hoverText}`
              )}>
                {t(mod.label, mod.label)}
              </span>
              {isActive && (
                <motion.div
                  layoutId="activeTopbarModuleIndicator"
                  className={cn("absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full shadow-[0_-1px_6px_rgba(124,58,237,0.4)]", mod.indicator)}
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* ── Right: Workspace, Currency, Language, Messages, Notifications & User Profile ── */}
      <div className="flex items-center gap-1 xl:gap-1.5 shrink-0 ml-1">
        {/* Highlighted Organization Switcher */}
        {isSwitcherAvailable ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-lg bg-gradient-to-r from-purple-50/90 to-emerald-50/80 border border-purple-200 hover:border-purple-400 shadow-2xs transition-all cursor-pointer group shrink-0">
                <div className="size-6.5 rounded-md gradient-brand text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
                  {renderCompanyLogo(company?.logo, company?.name)}
                </div>
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1 leading-none">
                    <span className="text-[8.5px] font-extrabold text-purple-700 tracking-wider uppercase">Active Org</span>
                    <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" title="Active" />
                  </div>
                  <span className="text-[11.5px] font-extrabold text-slate-900 leading-tight mt-0.5 max-w-[100px] xl:max-w-[140px] truncate">
                    {company?.name || "Main Organization"}
                  </span>
                </div>
                <ChevronDown className="size-3 text-purple-600 shrink-0 ml-0.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 shadow-xl border-purple-100">
              <div className="px-3 py-2 border-b bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
                  <Building2 className="size-3.5 text-purple-700" /> Switch Organization
                </span>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                  {companiesList.length} Org{companiesList.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {companiesList.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                    No organizations found.
                  </div>
                ) : (
                  companiesList.map((c) => {
                    const isSelected = company?.id === c.id;
                    return (
                      <DropdownMenuItem
                        key={c.id}
                        onClick={() => {
                          setCompany(c);
                          toast.success(`Active organization switched to "${c.name}"`);
                        }}
                        className={cn(
                          "gap-2 cursor-pointer py-2",
                          isSelected && "bg-purple-50/80 font-bold"
                        )}
                      >
                        <div className="size-7 rounded-md gradient-brand grid place-items-center text-white text-[10px] font-bold shrink-0 overflow-hidden">
                          {renderCompanyLogo(c.logo, c.name, "size-3.5")}
                        </div>
                        <div className="flex-1 font-semibold truncate">
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                            {c.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">{c.industry || "General Entity"}</div>
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-1 text-[10px] font-black text-emerald-600 shrink-0">
                            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" /> Active
                          </div>
                        )}
                      </DropdownMenuItem>
                    );
                  })
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => navigate({ to: "/erp?tab=companies" as any })}
                className="gap-2 cursor-pointer py-2 text-xs font-bold text-purple-700 hover:bg-purple-50"
              >
                <Plus className="size-3.5 text-purple-600" /> Manage / Add Organizations
              </DropdownMenuItem>
              {isPlatformSuperAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => navigate({ to: "/platform-admin" })}
                    className="gap-2 cursor-pointer py-2.5 text-violet-700 dark:text-violet-300 font-bold bg-violet-50/90 dark:bg-violet-950/40 hover:bg-violet-100"
                  >
                    <ShieldAlert className="size-4 text-violet-600 shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-bold">⚡ All Workspaces Hub</div>
                      <div className="text-[10px] font-normal text-muted-foreground">Create, suspend, or configure all tenants</div>
                    </div>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-0.5 rounded-lg bg-gradient-to-r from-purple-50/90 to-emerald-50/80 border border-purple-200 shadow-2xs shrink-0 select-none">
            <div className="size-6.5 rounded-md gradient-brand text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0 overflow-hidden">
              {renderCompanyLogo(company?.logo, company?.name)}
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1 leading-none">
                <span className="text-[8.5px] font-extrabold text-purple-700 tracking-wider uppercase">Workspace</span>
                <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" title="Active" />
              </div>
              <span className="text-[11.5px] font-extrabold text-slate-900 leading-tight mt-0.5 max-w-[120px] xl:max-w-[150px] truncate">
                {company?.name || "Main Workspace"}
              </span>
            </div>
          </div>
        )}

        {/* Platform Admin Control Center Button */}
        {isPlatformSuperAdmin && (
          <button
            onClick={() => navigate({ to: "/platform-admin" })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-md shadow-violet-500/20 hover:from-violet-500 hover:to-indigo-500 border border-violet-400/40 text-xs font-bold transition-all cursor-pointer shrink-0"
            title="Open Platform Governance & Tenant Control Center"
          >
            <ShieldAlert className="size-3.5 text-amber-300 animate-pulse" />
            <span className="hidden sm:inline">⚡ Platform Control Center</span>
          </button>
        )}

        {/* Currency Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="hidden md:flex items-center gap-1 h-8 px-2 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Change Currency"
            >
              <span className="font-bold text-slate-900">{activeCurrency.symbol}</span>
              <span className="text-[11px] text-slate-500">{activeCurrency.code}</span>
              <ChevronDown className="size-3 text-slate-400 ml-0.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 shadow-lg">
            <DropdownMenuLabel className="text-xs font-semibold text-slate-600">Select Currency</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {AVAILABLE_CURRENCIES.map((curr) => (
              <DropdownMenuItem
                key={curr.code}
                onClick={() => handleCurrencySelect(curr.code)}
                className={cn(
                  "flex items-center justify-between cursor-pointer text-xs px-2 py-1.5 rounded-md",
                  activeCurrency.code === curr.code ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted"
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="font-bold w-4 text-center">{curr.symbol}</span>
                  <span>{curr.code}</span>
                </span>
                {activeCurrency.code === curr.code && (
                  <div className="size-1.5 rounded-full bg-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Language Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="hidden md:flex items-center gap-1 h-8 px-2 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Change Language"
            >
              <Globe className="size-3.5 text-slate-500" />
              <span className="text-[11px] text-slate-600 font-semibold">{LANGUAGE_LABELS[language] ?? "EN"}</span>
              <ChevronDown className="size-3 text-slate-400 ml-0.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 shadow-lg max-h-[380px] overflow-y-auto">
            <DropdownMenuLabel className="text-xs font-semibold text-slate-600">🌐 Language / भाषा / భాష / தமிழ்</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setLanguage("en")} className="flex items-center justify-between cursor-pointer text-xs">
              <span className="flex items-center gap-2">🇺🇸 English</span>
              {language === "en" && <div className="size-1.5 rounded-full bg-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage("ar")} className="flex items-center justify-between cursor-pointer text-xs">
              <span className="flex items-center gap-2">🇦🇪 العربية (Arabic)</span>
              {language === "ar" && <div className="size-1.5 rounded-full bg-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage("te")} className="flex items-center justify-between cursor-pointer text-xs">
              <span className="flex items-center gap-2">🇮🇳 తెలుగు (Telugu)</span>
              {language === "te" && <div className="size-1.5 rounded-full bg-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage("hi")} className="flex items-center justify-between cursor-pointer text-xs">
              <span className="flex items-center gap-2">🇮🇳 हिन्दी (Hindi)</span>
              {language === "hi" && <div className="size-1.5 rounded-full bg-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage("kn")} className="flex items-center justify-between cursor-pointer text-xs">
              <span className="flex items-center gap-2">🇮🇳 ಕನ್ನಡ (Kannada)</span>
              {language === "kn" && <div className="size-1.5 rounded-full bg-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage("ta")} className="flex items-center justify-between cursor-pointer text-xs">
              <span className="flex items-center gap-2">🇮🇳 தமிழ் (Tamil)</span>
              {language === "ta" && <div className="size-1.5 rounded-full bg-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage("ml")} className="flex items-center justify-between cursor-pointer text-xs">
              <span className="flex items-center gap-2">🇮🇳 മലയാളം (Malayalam)</span>
              {language === "ml" && <div className="size-1.5 rounded-full bg-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage("mr")} className="flex items-center justify-between cursor-pointer text-xs">
              <span className="flex items-center gap-2">🇮🇳 मराठी (Marathi)</span>
              {language === "mr" && <div className="size-1.5 rounded-full bg-primary" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Global Live WhatsApp Connection Status Indicator */}
        <WhatsAppStatusIndicator variant="pill" />

        {/* Interactive Workspace Messages Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100 relative rounded-lg cursor-pointer transition-transform active:scale-95"
              title="Workspace Messages & Communications"
            >
              <MessageSquare className="size-3.5" />
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-purple-600 ring-2 ring-white animate-pulse" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[380px] sm:w-[420px] p-0 shadow-2xl rounded-2xl border bg-card overflow-hidden">
            {/* Popover Header */}
            <div className="px-4 py-3 border-b bg-gradient-to-r from-purple-50/80 via-white to-indigo-50/80 dark:from-purple-950/40 dark:to-slate-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg gradient-brand text-white flex items-center justify-center shadow-xs">
                  <MessageCircle className="size-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                    Workspace Hub
                  </h4>
                  <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
                    {tenant.name || "Active Company"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10.5px]">
                <button
                  type="button"
                  onClick={() => setActiveMessageTab("team")}
                  className={cn(
                    "px-2 py-1 rounded-md font-semibold transition-all",
                    activeMessageTab === "team" ? "bg-white dark:bg-slate-900 shadow-xs text-purple-700 font-bold" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  Team
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMessageTab("broadcasts")}
                  className={cn(
                    "px-2 py-1 rounded-md font-semibold transition-all",
                    activeMessageTab === "broadcasts" ? "bg-white dark:bg-slate-900 shadow-xs text-purple-700 font-bold" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  Notices
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMessageTab("assistant")}
                  className={cn(
                    "px-2 py-1 rounded-md font-semibold transition-all flex items-center gap-1",
                    activeMessageTab === "assistant" ? "bg-white dark:bg-slate-900 shadow-xs text-purple-700 font-bold" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  <Bot className="size-2.5 text-purple-600" /> AI
                </button>
              </div>
            </div>

            {/* TAB 1: Team Chat */}
            {activeMessageTab === "team" && (
              <div className="flex flex-col h-[420px]">
                {/* Horizontal Channel & Direct Message Selector */}
                <div className="flex items-center gap-1.5 p-2 border-b bg-slate-50/70 dark:bg-slate-900/50 overflow-x-auto shrink-0 scrollbar-none">
                  {defaultTeamChannels.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedThreadId(c.id)}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all border cursor-pointer",
                        selectedThreadId === c.id
                          ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                          : "bg-background text-slate-700 dark:text-slate-300 border-border hover:bg-muted"
                      )}
                    >
                      <span>{c.avatar}</span>
                      <span className="font-mono text-[11px]">#{c.name}</span>
                    </button>
                  ))}
                  {colleagues.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => setSelectedThreadId(emp.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all border cursor-pointer",
                        selectedThreadId === emp.id
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-background text-slate-700 dark:text-slate-300 border-border hover:bg-muted"
                      )}
                    >
                      <UserIcon className="size-3 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[100px]">{emp.name}</span>
                    </button>
                  ))}
                </div>

                {/* Active Channel Subheader */}
                <div className="px-3 py-1.5 bg-slate-100/50 dark:bg-slate-900/40 border-b flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
                  <div className="truncate">
                    {(() => {
                      const ch = defaultTeamChannels.find((c) => c.id === selectedThreadId);
                      if (ch) return <span className="font-semibold text-slate-700 dark:text-slate-200">{ch.avatar} {ch.title}: <span className="font-normal opacity-80">{ch.desc}</span></span>;
                      const emp = colleagues.find((e) => e.id === selectedThreadId);
                      if (emp) return <span className="font-semibold text-indigo-700 dark:text-indigo-300">👤 {emp.name} <span className="font-normal opacity-80">({emp.role})</span></span>;
                      return <span>Team Discussion Channel</span>;
                    })()}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200">● Live Synced</span>
                </div>

                {/* Conversation Body */}
                <div className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-slate-50/30 dark:bg-slate-950/20 text-xs">
                  {(() => {
                    const activeMessages = teamMessages[selectedThreadId] || [];
                    if (activeMessages.length === 0) {
                      return (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                          <MessageSquare className="size-8 text-slate-300 mb-2" />
                          <p className="font-semibold text-slate-600 dark:text-slate-300">No messages in this thread yet</p>
                          <p className="text-[11px]">Send the first message below to collaborate with team members.</p>
                        </div>
                      );
                    }
                    return activeMessages.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "flex flex-col max-w-[85%] rounded-2xl p-2.5 shadow-2xs",
                          m.isSelf
                            ? "ml-auto bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-xs"
                            : "mr-auto bg-white dark:bg-slate-800 border text-slate-800 dark:text-slate-100 rounded-bl-xs"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={cn("font-bold text-[10px]", m.isSelf ? "text-purple-100" : "text-purple-600")}>
                            {m.sender} <span className="opacity-75 font-normal">({m.role})</span>
                          </span>
                          <span className={cn("text-[9px]", m.isSelf ? "text-purple-200" : "text-slate-400")}>
                            {m.time}
                          </span>
                        </div>
                        {m.tag && (
                          <div className="mb-1">
                            <span className={cn(
                              "text-[9px] font-bold px-1.5 py-0.5 rounded",
                              m.isSelf ? "bg-white/20 text-white" : "bg-purple-100 text-purple-800 border border-purple-200"
                            )}>
                              {m.tag}
                            </span>
                          </div>
                        )}
                        <p className="leading-relaxed text-xs">{m.text}</p>
                      </div>
                    ));
                  })()}
                </div>

                {/* Send Message Input with Tag Pills */}
                <form onSubmit={handleSendMessage} className="p-2.5 border-t bg-background shrink-0 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <select
                      value={messageTag}
                      onChange={(e) => setMessageTag(e.target.value)}
                      className="text-[10px] font-semibold h-7 px-1.5 rounded-lg border bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                      title="Select message tag"
                    >
                      <option value="Normal">💬 Normal</option>
                      <option value="Urgent 🚨">🚨 Urgent</option>
                      <option value="Stock Request 📦">📦 Stock</option>
                      <option value="Billing / Invoice 📄">📄 Invoice</option>
                    </select>
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder="Type a team message..."
                      className="flex-1 text-xs px-3 py-1.5 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border-none outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="h-7 px-3 rounded-lg gradient-brand text-white text-xs font-semibold shadow-xs cursor-pointer"
                    >
                      <Send className="size-3" />
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 2: Workspace Broadcasts / Notices */}
            {activeMessageTab === "broadcasts" && (
              <div className="flex flex-col h-[420px]">
                {/* Notices Header Actions */}
                <div className="p-2 border-b bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Megaphone className="size-3.5 text-purple-600" />
                    <span>Workspace Notices ({broadcasts.length})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => loadBroadcasts()}
                      className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
                      title="Refresh Notices"
                    >
                      <RefreshCw className={cn("size-3", isLoadingBroadcasts && "animate-spin text-purple-600")} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPostingNotice(!isPostingNotice)}
                      className="px-2 py-1 rounded-lg text-[10.5px] font-bold bg-purple-600 text-white hover:bg-purple-700 transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Plus className="size-3" />
                      <span>{isPostingNotice ? "View Notices" : "Post Notice"}</span>
                    </button>
                  </div>
                </div>

                {isPostingNotice ? (
                  /* Create / Post Notice Form */
                  <form onSubmit={handlePublishNotice} className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-card">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Notice Title <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newNoticeTitle}
                        onChange={(e) => setNewNoticeTitle(e.target.value)}
                        placeholder="e.g. Month-End Stock Count / Store Schedule"
                        className="w-full text-xs px-3 py-1.5 rounded-lg border bg-background focus:ring-1 focus:ring-purple-500 outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Category
                      </label>
                      <select
                        value={newNoticeCategory}
                        onChange={(e) => setNewNoticeCategory(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border bg-background focus:ring-1 focus:ring-purple-500 outline-none cursor-pointer"
                      >
                        <option value="notice">📢 General Notice</option>
                        <option value="urgent">🚨 Urgent / Action Required</option>
                        <option value="policy">📜 Policy & Compliance</option>
                        <option value="feature">✨ System / Store Update</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Notice Content <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={4}
                        value={newNoticeBody}
                        onChange={(e) => setNewNoticeBody(e.target.value)}
                        placeholder="Enter notice details for all organization team members..."
                        className="w-full text-xs px-3 py-2 rounded-lg border bg-background focus:ring-1 focus:ring-purple-500 outline-none resize-none"
                        required
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsPostingNotice(false)}
                        className="h-8 text-xs cursor-pointer"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmittingNotice}
                        size="sm"
                        className="h-8 px-4 gradient-brand text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                      >
                        {isSubmittingNotice ? (
                          <>
                            <Loader2 className="size-3 animate-spin mr-1.5" />
                            Broadcasting...
                          </>
                        ) : (
                          <>
                            <Megaphone className="size-3 mr-1.5" />
                            Broadcast to Team
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                ) : (
                  /* Notices List */
                  <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
                    {broadcasts.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                        <Megaphone className="size-8 text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600 dark:text-slate-300">No active notices</p>
                        <p className="text-[11px] mt-0.5">Click 'Post Notice' to broadcast an announcement to your team.</p>
                      </div>
                    ) : (
                      broadcasts.map((b) => (
                        <div key={b.id} className="p-3 rounded-xl border bg-background hover:bg-slate-50/70 transition-colors space-y-1.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              "text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border",
                              b.category === "urgent"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : b.category === "policy"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : b.category === "feature"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-purple-50 text-purple-700 border-purple-200"
                            )}>
                              {b.category || "Notice"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {b.created_at ? new Date(b.created_at).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Today"}
                            </span>
                          </div>
                          <h5 className="font-bold text-xs text-foreground">{b.title}</h5>
                          <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line">{b.body}</p>
                          <div className="text-[9.5px] text-purple-700 font-semibold pt-1 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 mt-2">
                            <span className="flex items-center gap-1">
                              <Megaphone className="size-2.5" /> Posted by {b.sender_name || (b as any).sent_by || "System Admin"}
                            </span>
                            {b.recipients_count ? (
                              <span className="text-[9px] text-slate-400">Delivered to {b.recipients_count} members</span>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: BusinessOS Copilot AI Assistant */}
            {activeMessageTab === "assistant" && (
              <div className="flex flex-col h-[420px]">
                {/* AI Header */}
                <div className="px-3 py-1.5 bg-purple-50/70 dark:bg-purple-950/30 border-b flex items-center justify-between text-[11px] shrink-0">
                  <span className="font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                    <Sparkles className="size-3 text-purple-600" />
                    BusinessOS Copilot AI
                  </span>
                  <button
                    type="button"
                    onClick={() => setAiChatHistory([{ sender: "ai", text: "Chat history cleared. How can I help you today?", time: "Just now" }])}
                    className="text-[10px] text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    Clear History
                  </button>
                </div>

                {/* Conversation Body */}
                <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
                  {aiChatHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "p-2.5 rounded-2xl max-w-[90%] leading-relaxed shadow-2xs",
                        item.sender === "user"
                          ? "ml-auto bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-xs"
                          : "mr-auto bg-white dark:bg-slate-800 border border-purple-100 dark:border-purple-900/40 text-slate-800 dark:text-slate-100 rounded-bl-xs"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={cn("font-bold text-[10px] flex items-center gap-1", item.sender === "ai" ? "text-purple-600" : "text-purple-100")}>
                          {item.sender === "ai" ? (
                            <>
                              <Bot className="size-3 text-purple-600" />
                              <span>BusinessOS AI</span>
                            </>
                          ) : (
                            <span>You</span>
                          )}
                        </span>
                        <span className={cn("text-[9px]", item.sender === "ai" ? "text-slate-400" : "text-purple-200")}>
                          {item.time}
                        </span>
                      </div>
                      <p className="whitespace-pre-line leading-relaxed text-xs">{item.text}</p>
                    </div>
                  ))}

                  {isAiLoading && (
                    <div className="mr-auto bg-white dark:bg-slate-800 border border-purple-100 dark:border-purple-900/40 p-2.5 rounded-2xl rounded-bl-xs flex items-center gap-2 text-xs text-purple-700 shadow-2xs">
                      <Loader2 className="size-3.5 animate-spin text-purple-600" />
                      <span className="font-medium text-[11px]">Copilot AI is analyzing workspace records...</span>
                    </div>
                  )}
                </div>

                {/* Quick AI Prompts */}
                <div className="px-3 py-1.5 flex items-center gap-1 overflow-x-auto border-t bg-slate-50/70 dark:bg-slate-900/40 shrink-0 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => handleSendAiAssistant("Show total product stock and inventory summary.")}
                    className="text-[10px] font-medium px-2 py-0.5 bg-background border rounded-full text-slate-600 hover:text-purple-700 whitespace-nowrap cursor-pointer hover:border-purple-300"
                  >
                    📦 Stock & Catalog
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendAiAssistant("How do I create a standard A4 GST tax invoice?")}
                    className="text-[10px] font-medium px-2 py-0.5 bg-background border rounded-full text-slate-600 hover:text-purple-700 whitespace-nowrap cursor-pointer hover:border-purple-300"
                  >
                    📄 Standard A4 Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendAiAssistant("How do I process a sales return and refund?")}
                    className="text-[10px] font-medium px-2 py-0.5 bg-background border rounded-full text-slate-600 hover:text-purple-700 whitespace-nowrap cursor-pointer hover:border-purple-300"
                  >
                    🔄 Sales Return
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendAiAssistant("How do I send invoices directly via WhatsApp to customers?")}
                    className="text-[10px] font-medium px-2 py-0.5 bg-background border rounded-full text-slate-600 hover:text-purple-700 whitespace-nowrap cursor-pointer hover:border-purple-300"
                  >
                    📱 WhatsApp Send
                  </button>
                </div>

                {/* AI Input Form */}
                <form onSubmit={(e) => handleSendAiAssistant(undefined, e)} className="p-2.5 border-t bg-background flex items-center gap-1.5 shrink-0">
                  <input
                    type="text"
                    value={aiAssistantInput}
                    onChange={(e) => setAiAssistantInput(e.target.value)}
                    placeholder="Ask Copilot AI anything about this company..."
                    disabled={isAiLoading}
                    className="flex-1 text-xs px-3 py-1.5 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border-none outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                  />
                  <Button
                    type="submit"
                    disabled={isAiLoading || !aiAssistantInput.trim()}
                    size="sm"
                    className="h-8 px-3 rounded-xl gradient-brand text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isAiLoading ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                  </Button>
                </form>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100 relative rounded-lg" title="Notifications">
              <Bell className="size-3.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 size-3.5 rounded-full bg-amber-500 text-white text-[8.5px] font-bold flex items-center justify-center leading-none">
                  {unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-84 p-0 shadow-xl rounded-xl border">
            <div className="px-4 py-3 border-b flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/50 rounded-t-xl">
              <div className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Bell className="size-3.5 text-purple-700" /> Notifications
                {unreadCount > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-purple-100 text-purple-700 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-purple-700 font-semibold hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1"
              >
                <CheckCheck className="size-3" /> Mark all read
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
              {activeNotifs.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  <Inbox className="size-6 mx-auto mb-1 text-slate-400" />
                  No notifications yet.
                </div>
              ) : (
                activeNotifs.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleSelectNotification(n)}
                    className={cn(
                      "px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors group relative",
                      n.unread && "bg-purple-50/40 dark:bg-purple-950/20"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {n.unread ? (
                        <div className="size-2 rounded-full bg-purple-700 mt-1.5 shrink-0 animate-pulse" />
                      ) : (
                        <div className="size-2 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                          {n.title}
                          {n.category && (
                            <span className="text-[9px] font-semibold uppercase px-1 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded">
                              {n.category}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                          {n.body}
                        </div>
                        <div className="text-[9.5px] text-slate-400 mt-1 flex items-center gap-1">
                          <Clock className="size-2.5" />
                          {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteNotification(n.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-2.5 top-3 p-1 text-slate-400 hover:text-destructive hover:bg-slate-100 rounded"
                        title="Dismiss"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-2.5 border-t bg-slate-50/80 dark:bg-slate-900/60 rounded-b-xl flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 font-medium">
                {activeNotifs.length} total notifications
              </span>
              <button
                onClick={() => setCenterOpen(true)}
                className="font-bold text-[11px] text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer hover:underline"
              >
                View in Notification Center <ArrowRight className="size-3" />
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* User Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center justify-center p-0.5 rounded-full hover:ring-2 hover:ring-purple-500/30 transition-all cursor-pointer outline-none focus:ring-2 focus:ring-purple-500/40"
              title={`${user?.name || "User"} (${activeRole?.name || "Super Admin"})`}
            >
              <div className="size-8 rounded-full gradient-brand text-white font-bold text-xs flex items-center justify-center shadow-xs transition-transform hover:scale-105 active:scale-95">
                {user?.avatar || "VE"}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 shadow-xl rounded-xl border border-slate-200/80 p-1">
            <div className="px-3 py-2.5 bg-slate-50/80 rounded-lg border border-slate-100 mb-1">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-full gradient-brand text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
                  {user?.avatar || "VE"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-800 truncate">{user?.name || "Venkat E."}</div>
                  <div className="text-xs text-slate-500 truncate">{user?.email || "venkat@venatic.com"}</div>
                </div>
              </div>
              <div className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-semibold text-purple-800 bg-purple-50 border border-purple-200/60 px-2 py-0.5 rounded-full">
                <ShieldCheck className="size-3 text-purple-600" /> {activeRole?.name || "Super Admin"}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] text-slate-400 font-semibold uppercase">Switch Role</DropdownMenuLabel>
            {availableRoles.map((r) => (
              <DropdownMenuItem key={r.id} onClick={() => setActiveRole(r)} className="cursor-pointer text-xs">
                {r.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {isPlatformSuperAdmin && (
              <>
                <DropdownMenuItem
                  onClick={() => navigate({ to: "/platform-admin" })}
                  className="cursor-pointer text-xs font-bold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 py-2"
                >
                  <ShieldAlert className="size-4 mr-2 text-violet-600" /> ⚡ Master Platform Console
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              onClick={() => setChangePasswordOpen(true)}
              className="cursor-pointer text-xs font-medium text-slate-700 hover:text-purple-700 dark:text-slate-200 dark:hover:text-purple-300 py-2"
            >
              <KeyRound className="size-4 mr-2 text-purple-600 dark:text-purple-400" /> Change Password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()} className="text-destructive cursor-pointer">
              <LogOut className="size-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ChangePasswordModal open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />

      {/* ─── Notification Full Message Reader Modal ─── */}
      {selectedNotif && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-card border p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Bell className="size-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-foreground leading-tight">
                      {selectedNotif.title}
                    </h3>
                    {selectedNotif.category && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {selectedNotif.category}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <Clock className="size-3" />
                    {selectedNotif.created_at ? new Date(selectedNotif.created_at).toLocaleString() : "Just now"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedNotif(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-4 bg-muted/40 rounded-xl text-sm leading-relaxed text-foreground whitespace-pre-wrap font-normal border border-border/40 max-h-64 overflow-y-auto">
              {selectedNotif.body}
            </div>

            <div className="flex items-center justify-between pt-2 border-t text-xs">
              <button
                type="button"
                onClick={() => handleDeleteNotification(selectedNotif.id)}
                className="px-3 py-1.5 text-destructive hover:bg-destructive/10 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="size-3.5" /> Dismiss
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedNotif(null)}
                  className="px-4 py-2 border rounded-lg hover:bg-muted font-medium"
                >
                  Close
                </button>
                {getActionRoute(selectedNotif) && (
                  <button
                    type="button"
                    onClick={() => handleNavigateFromNotif(selectedNotif)}
                    className="px-4 py-2 gradient-brand text-white rounded-lg font-semibold shadow-sm hover:opacity-90 flex items-center gap-1.5"
                  >
                    <span>{getActionRoute(selectedNotif)?.label}</span>
                    <ExternalLink className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Full Notification Center Modal ─── */}
      {centerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-card border p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3.5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl gradient-brand text-white flex items-center justify-center shadow-xs">
                  <Bell className="size-4.5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-foreground leading-tight flex items-center gap-2">
                    Notification Center
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                      {activeNotifs.length} total
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Complete feed of real-time workspace broadcasts, system alerts, CRM leads, and operations.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg flex items-center gap-1.5 border border-primary/20 transition-colors"
                >
                  <CheckCheck className="size-3.5" /> Mark All as Read
                </button>
                <button
                  onClick={() => setCenterOpen(false)}
                  className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted"
                >
                  <X className="size-4.5" />
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between shrink-0">
              <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                {["all", "unread", "crm", "hrms", "pos", "inventory", "system"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setNotifFilterCategory(cat)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold capitalize transition-colors shrink-0",
                      notifFilterCategory === cat
                        ? "bg-primary text-white shadow-xs"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {cat === "all" ? "All" : cat === "unread" ? "Unread" : cat.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={notifSearchQuery}
                  onChange={(e) => setNotifSearchQuery(e.target.value)}
                  placeholder="Search notifications..."
                  className="w-full h-8.5 pl-8.5 pr-3 text-xs rounded-lg border bg-background"
                />
              </div>
            </div>

            {/* Notification Stream */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[300px]">
              {(() => {
                const filtered = activeNotifs.filter((n) => {
                  if (notifFilterCategory === "unread" && !n.unread) return false;
                  if (notifFilterCategory !== "all" && notifFilterCategory !== "unread" && (n.category || "system").toLowerCase() !== notifFilterCategory) return false;
                  if (notifSearchQuery.trim()) {
                    const q = notifSearchQuery.toLowerCase();
                    return (n.title || "").toLowerCase().includes(q) || (n.body || "").toLowerCase().includes(q);
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                      <Inbox className="size-10 text-slate-300 dark:text-slate-700 mb-2" />
                      <p className="text-sm font-semibold">No notifications found</p>
                      <p className="text-xs">No records match your selected filter criteria.</p>
                    </div>
                  );
                }

                return filtered.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "p-4 rounded-xl border transition-all hover:border-primary/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card shadow-xs group",
                      n.unread ? "border-purple-300 dark:border-purple-800 bg-purple-50/20 dark:bg-purple-950/10" : "border-border/60"
                    )}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {n.unread ? (
                        <div className="size-2.5 rounded-full bg-purple-700 mt-1 shrink-0 animate-pulse" />
                      ) : (
                        <div className="size-2.5 rounded-full bg-slate-300 mt-1 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-foreground">{n.title}</h4>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {n.category || "system"}
                          </span>
                          {n.unread && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-500/10 text-amber-600 rounded">
                              Unread
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {n.body}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1.5 flex items-center gap-1">
                          <Clock className="size-3" />
                          {n.created_at ? new Date(n.created_at).toLocaleString() : "Recently"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {getActionRoute(n) && (
                        <button
                          type="button"
                          onClick={() => handleNavigateFromNotif(n)}
                          className="px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg flex items-center gap-1 border border-primary/20 transition-colors"
                        >
                          <span>{getActionRoute(n)?.label}</span>
                          <ArrowRight className="size-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteNotification(n.id, e)}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        title="Delete notification"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ─── Mobile Navigation Slide-Over Drawer (< lg screens) ─── */}
      <AnimatePresence>
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileNavOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
            />

            {/* Slide-over Panel */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full max-w-xs bg-white h-full shadow-2xl flex flex-col z-10 border-r border-slate-200"
            >
              {/* Drawer Header */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center p-1.5 rounded-lg bg-white">
                  <img src="/Logo.png" alt="IoTRONCS" className="h-6 w-auto object-contain" />
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Active Workspace Info */}
              <div className="p-3.5 bg-purple-50/70 border-b border-purple-100 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="size-7 rounded-md gradient-brand text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {renderCompanyLogo(company?.logo, company?.name, "size-3.5")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[9.5px] font-bold uppercase text-purple-700">Active Workspace</div>
                    <div className="text-xs font-bold text-slate-900 truncate">{company?.name || "Main Workspace"}</div>
                  </div>
                </div>
              </div>

              {/* Modules List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                <div className="text-[10px] font-bold uppercase text-slate-400 px-2 py-1">All Business Modules</div>
                {visibleModules.map((mod) => {
                  const isActive = currentActiveGroup === mod.group;
                  const Icon = mod.icon;
                  return (
                    <button
                      key={mod.group}
                      type="button"
                      onClick={() => {
                        setMobileNavOpen(false);
                        handleNavigateModule(mod.defaultTo);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left font-semibold text-xs transition-all cursor-pointer",
                        isActive
                          ? "bg-purple-600 text-white shadow-sm shadow-purple-600/20 font-bold"
                          : "text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      <Icon className={cn("size-4.5 shrink-0", isActive ? "text-white" : "text-slate-500")} />
                      <span className="flex-1">{mod.label}</span>
                      {isActive && <div className="size-2 rounded-full bg-white" />}
                    </button>
                  );
                })}
              </div>

              {/* Bottom Drawer Controls */}
              <div className="p-3 border-t border-slate-200 bg-slate-50/80 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                    <Coins className="size-3.5 text-slate-400" /> Currency:
                  </div>
                  <select
                    value={activeCurrency.code}
                    onChange={(e) => handleCurrencySelect(e.target.value)}
                    className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800"
                  >
                    {AVAILABLE_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                    <Globe className="size-3.5 text-slate-400" /> Language:
                  </div>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as any)}
                    className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800"
                  >
                    <option value="en">🇺🇸 English (US)</option>
                    <option value="ar">🇦🇪 العربية (Arabic)</option>
                    <option value="te">🇮🇳 తెలుగు (Telugu)</option>
                    <option value="hi">🇮🇳 हिन्दी (Hindi)</option>
                    <option value="kn">🇮🇳 ಕನ್ನಡ (Kannada)</option>
                    <option value="ta">🇮🇳 தமிழ் (Tamil)</option>
                    <option value="ml">🇮🇳 മലയാളം (Malayalam)</option>
                    <option value="mr">🇮🇳 मराठी (Marathi)</option>
                  </select>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </header>
  );
}
