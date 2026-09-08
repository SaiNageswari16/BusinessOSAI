import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Bell, MessageSquare, LogOut,
  ChevronDown, Building2, ShieldCheck, ShieldAlert, Globe, Coins,
  Component, Archive, Layers, Terminal, ShoppingCart,
  ShoppingBag, Receipt, UsersRound, BarChart3, Settings,
  LayoutDashboard, RadioTower, ExternalLink, Trash2,
  CheckCheck, Search, Filter, Clock, Sparkles, Inbox,
  Eye, X, ArrowRight, Send, Megaphone, Bot, MessageCircle, Calculator,
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
import { useI18n } from "@/contexts/i18n-context";
import { notifications } from "@/data/mock";
import { nav } from "@/data/navigation";
import { CommandPalette } from "@/components/command-palette";
import { cn, AVAILABLE_CURRENCIES, getActiveCurrency, setActiveCurrency } from "@/lib/utils";
import { liveNotificationsApi, LiveNotification } from "@/lib/api-client";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

const moduleDisplayList = [
  { 
    group: "Workspace", 
    label: "Workspace", 
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
    group: "Core ERP", 
    label: "Core ERP", 
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
    group: "Operations", 
    label: "Operations", 
    icon: Layers, 
    defaultTo: "/procurement?tab=purchase_requests", 
    permission: "view:procurement",
    activeText: "text-purple-700",
    activeBg: "bg-purple-50/90",
    hoverText: "group-hover:text-purple-700",
    hoverBg: "hover:bg-purple-50/50",
    indicator: "bg-purple-700",
  },
  { 
    group: "POS", 
    label: "POS", 
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
    group: "Sales & CRM", 
    label: "Sales & CRM", 
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
    group: "Accounting & Finance", 
    label: "Accounting", 
    icon: Calculator, 
    defaultTo: "/accounting?tab=chart_of_accounts", 
    permission: "view:accounting",
    activeText: "text-purple-700",
    activeBg: "bg-purple-50/90",
    hoverText: "group-hover:text-purple-700",
    hoverBg: "hover:bg-purple-50/50",
    indicator: "bg-purple-700",
  },
  { 
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
    group: "Analytics & Intelligence", 
    label: "Analytics", 
    icon: BarChart3, 
    defaultTo: "/reports?tab=sales_reports", 
    permission: "view:analytics",
    activeText: "text-purple-700",
    activeBg: "bg-purple-50/90",
    hoverText: "group-hover:text-purple-700",
    hoverBg: "hover:bg-purple-50/50",
    indicator: "bg-purple-700",
  },
  { 
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

export function AppTopbar() {
  const { currency } = useCurrency();
  const { user, logout } = useAuth();
  const { language, setLanguage } = useI18n();
  const {
    tenant,
    tenant: company,
    setTenant: setCompany,
    companiesList,
  } = useTenant();
  const { activeRole, availableRoles, setActiveRole, hasPermission } = useRbac();
  const navigate = useNavigate();
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activeCurrency, setActiveCurrencyState] = useState(getActiveCurrency());
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);

  const isPlatformSuperAdmin = Boolean(user?.isPlatformAdmin);

  // Filter modules to only those the current user has permission to access
  const visibleModules = useMemo(() => {
    return moduleDisplayList.filter((mod) => !mod.permission || hasPermission(mod.permission));
  }, [hasPermission]);

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
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>("t1");
  const [messageInput, setMessageInput] = useState("");
  const [aiAssistantInput, setAiAssistantInput] = useState("");
  const [aiChatHistory, setAiChatHistory] = useState<Array<{ sender: "user" | "ai"; text: string; time: string }>>([
    { sender: "ai", text: "Hello! I am your BusinessOS AI Assistant. Ask me anything about stock movement, workspace invoices, or inventory status.", time: "Just now" }
  ]);
  const [teamThreads, setTeamThreads] = useState([
    {
      id: "t1",
      name: "Operations & Logistics",
      avatar: "OP",
      lastMsg: "Inter-workspace stock transfer REC-809 dispatched successfully.",
      time: "10m ago",
      unread: 1,
      messages: [
        { id: "m1", sender: "Priya Sharma", role: "Logistics Lead", text: "Stock transfer requested from Main Store to Warehouse 2.", time: "10:15 AM", isSelf: false },
        { id: "m2", sender: "You", role: "Manager", text: "Approved. Please ensure goods receipt note is tagged.", time: "10:20 AM", isSelf: true },
        { id: "m3", sender: "Priya Sharma", role: "Logistics Lead", text: "Inter-workspace stock transfer REC-809 dispatched successfully.", time: "10:25 AM", isSelf: false }
      ]
    },
    {
      id: "t2",
      name: "Finance & Accounts",
      avatar: "FA",
      lastMsg: "GST e-invoices reconciled for current active workspace.",
      time: "1h ago",
      unread: 0,
      messages: [
        { id: "m4", sender: "Rahul Verma", role: "Chief Accountant", text: "GST e-invoices reconciled for current active workspace.", time: "09:30 AM", isSelf: false }
      ]
    },
    {
      id: "t3",
      name: "POS Retail Counter",
      avatar: "POS",
      lastMsg: "Terminal 01 cash register opened with opening float ₹5,000.",
      time: "2h ago",
      unread: 0,
      messages: [
        { id: "m5", sender: "Cashier Desk", role: "POS Operator", text: "Terminal 01 cash register opened with opening float ₹5,000.", time: "08:00 AM", isSelf: false }
      ]
    }
  ]);

  const [broadcasts, setBroadcasts] = useState([
    {
      id: "b1",
      title: "Workspace Inventory Audit Tomorrow",
      author: "System Administrator",
      date: "Today at 09:00 AM",
      body: "All department managers must finalize pending stock adjustments before 6 PM.",
      tag: "Notice",
      tagColor: "bg-purple-100 text-purple-700"
    },
    {
      id: "b2",
      title: "New Inter-Workspace Stock Transfer Enabled",
      author: "Supply Chain HQ",
      date: "Yesterday",
      body: "You can now seamlessly transfer inventory and raw materials between separate company workspaces with instant real-time synchronization.",
      tag: "Feature",
      tagColor: "bg-emerald-100 text-emerald-700"
    }
  ]);

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

    setTeamThreads(prev => prev.map(t => {
      if (t.id === selectedThreadId) {
        const updatedMsgs = [
          ...t.messages,
          { id: `msg-${Date.now()}`, sender: "You", role: "Manager", text: newMsgText, time: "Just now", isSelf: true }
        ];
        return {
          ...t,
          lastMsg: newMsgText,
          time: "Just now",
          messages: updatedMsgs
        };
      }
      return t;
    }));

    toast.success("Message sent to team channel!");

    // Simulate auto-acknowledgement after 1.5s
    setTimeout(() => {
      setTeamThreads(prev => prev.map(t => {
        if (t.id === selectedThreadId) {
          const ackMsg = {
            id: `msg-${Date.now()}`,
            sender: t.name.split(" ")[0] + " Bot",
            role: "Automated ACK",
            text: `Received: "${newMsgText.slice(0, 30)}..." - updating workspace records.`,
            time: "Just now",
            isSelf: false
          };
          return {
            ...t,
            lastMsg: ackMsg.text,
            time: "Just now",
            messages: [...t.messages, ackMsg]
          };
        }
        return t;
      }));
    }, 1500);
  };

  const handleSendAiAssistant = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiAssistantInput.trim()) return;

    const query = aiAssistantInput.trim();
    setAiAssistantInput("");

    setAiChatHistory(prev => [
      ...prev,
      { sender: "user", text: query, time: "Just now" }
    ]);

    // Intelligent context response
    setTimeout(() => {
      let reply = `In ${tenant.name || "your active workspace"}, inventory and stock movement operations are synchronized with the backend. You can initiate inter-workspace transfers directly from the Stock Movement tab.`;
      const qLower = query.toLowerCase();
      if (qLower.includes("stock") || qLower.includes("warehouse") || qLower.includes("transfer")) {
        reply = `To transfer stock between workspaces, go to Inventory > Stock Movement > 'Inter-Workspace Transfer'. Choose your source warehouse in ${tenant.name} and destination warehouse in your other company.`;
      } else if (qLower.includes("user") || qLower.includes("role") || qLower.includes("split")) {
        reply = `Users can be split across specific workspaces from Core ERP > User Management. You can filter and assign staff to ${tenant.name} or keep them organization-wide.`;
      } else if (qLower.includes("pos") || qLower.includes("bill") || qLower.includes("sale")) {
        reply = `POS transactions are scoped to ${tenant.name}. Receipts and stock deductions take effect in your default Main Store warehouse.`;
      }

      setAiChatHistory(prev => [
        ...prev,
        { sender: "ai", text: reply, time: "Just now" }
      ]);
    }, 600);
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
        } else {
          if (currentPathWithSearch.includes(item.to)) return group.group;
        }
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
      {/* ── Left: LazyMonkeyAI Brand Logo ── */}
      <div 
        onClick={() => {
          const firstAllowed = visibleModules[0]?.defaultTo || "/dashboard";
          handleNavigateModule(firstAllowed);
        }}
        className="flex items-center gap-2 cursor-pointer group shrink-0 mr-1 xl:mr-2"
      >
        <div className="size-8.5 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 overflow-hidden shrink-0">
          <img src="/Logo.png" alt="LazyMonkeyAI Logo" className="size-full object-contain" />
        </div>
        <div className="hidden sm:flex flex-col justify-center">
          <div className="font-extrabold text-[15px] text-slate-900 tracking-tight leading-none flex items-center">
            <span className="text-purple-700">Lazy</span>Monkey<span className="text-emerald-600">AI</span>
          </div>
          <div className="text-[10px] font-semibold tracking-normal leading-none mt-1 flex items-center gap-1">
            <span className="text-slate-600 font-medium">Smart</span>
            <span className="text-emerald-600 font-extrabold">AI</span>
            <span className="text-slate-600 font-medium">for</span>
            <span className="text-amber-600 font-bold">Lazy Geniuses</span>
          </div>
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
                {mod.label}
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
        {/* Highlighted Workspace Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-lg bg-gradient-to-r from-purple-50/90 to-emerald-50/80 border border-purple-200 hover:border-purple-400 shadow-2xs transition-all cursor-pointer group shrink-0">
              <div className="size-6.5 rounded-md gradient-brand text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                {company?.logo ? (
                  <span className="text-[10px]">{company.logo}</span>
                ) : (
                  <Building2 className="size-3" />
                )}
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1 leading-none">
                  <span className="text-[8.5px] font-extrabold text-purple-700 tracking-wider uppercase">Workspace</span>
                  <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" title="Active" />
                </div>
                <span className="text-[11.5px] font-extrabold text-slate-900 leading-tight mt-0.5 max-w-[100px] xl:max-w-[130px] truncate">
                  {company?.name || "Main Workspace"}
                </span>
              </div>
              <ChevronDown className="size-3 text-purple-600 shrink-0 ml-0.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 shadow-xl border-purple-100">
            <div className="px-3 py-2 border-b bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
                <Building2 className="size-3.5 text-purple-700" /> Workspaces & Tenants
              </span>
              {isPlatformSuperAdmin && (
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                  ⚡ Super Admin
                </span>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {companiesList.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                  No other workspaces found.
                </div>
              ) : (
                companiesList.map((c) => (
                  <DropdownMenuItem key={c.id} onClick={() => setCompany(c)} className="gap-2 cursor-pointer py-2">
                    <div className="size-7 rounded-md gradient-brand grid place-items-center text-white text-[10px] font-bold shrink-0">{c.logo || "CO"}</div>
                    <div className="flex-1 font-semibold truncate">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{c.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{c.industry || "Client Workspace"}</div>
                    </div>
                    {company?.id === c.id && <div className="size-2 rounded-full bg-purple-700 shrink-0" />}
                  </DropdownMenuItem>
                ))
              )}
            </div>
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

        {/* Platform Admin God Mode Button */}
        {isPlatformSuperAdmin && (
          <button
            onClick={() => navigate({ to: "/platform-admin" })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-md shadow-violet-500/20 hover:from-violet-500 hover:to-indigo-500 border border-violet-400/40 text-xs font-bold transition-all cursor-pointer shrink-0"
            title="Open Platform Super Admin Control Center (God Mode)"
          >
            <ShieldAlert className="size-3.5 text-amber-300 animate-pulse" />
            <span className="hidden sm:inline">⚡ God Mode Hub</span>
          </button>
        )}

        {/* Currency Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1 h-8 px-2 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
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
              className="flex items-center gap-1 h-8 px-2 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Change Language"
            >
              <Globe className="size-3.5 text-slate-500" />
              <span className="text-[11px] text-slate-600">{language === "ar" ? "العربية" : "EN"}</span>
              <ChevronDown className="size-3 text-slate-400 ml-0.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 shadow-lg">
            <DropdownMenuLabel className="text-xs font-semibold text-slate-600">Language / اللغة</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setLanguage("en")} className="flex items-center justify-between cursor-pointer text-xs">
              <span className="flex items-center gap-2">🇺🇸 English</span>
              {language === "en" && <div className="size-1.5 rounded-full bg-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage("ar")} className="flex items-center justify-between cursor-pointer text-xs font-bold">
              <span className="flex items-center gap-2">🇦🇪 العربية (Arabic)</span>
              {language === "ar" && <div className="size-1.5 rounded-full bg-primary" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
              <div className="flex flex-col h-[380px]">
                {/* Threads horizontal selector */}
                <div className="flex items-center gap-1.5 p-2 border-b bg-slate-50/50 dark:bg-slate-900/30 overflow-x-auto shrink-0">
                  {teamThreads.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedThreadId(t.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all border",
                        selectedThreadId === t.id
                          ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                          : "bg-background text-slate-700 dark:text-slate-300 border-border hover:bg-muted"
                      )}
                    >
                      <span className="text-[10px] uppercase font-bold">{t.avatar}</span>
                      <span className="truncate max-w-[110px]">{t.name}</span>
                    </button>
                  ))}
                </div>

                {/* Conversation Body */}
                <div className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-slate-50/30 dark:bg-slate-950/20 text-xs">
                  {(() => {
                    const currentThread = teamThreads.find(t => t.id === selectedThreadId) || teamThreads[0];
                    return currentThread.messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "flex flex-col max-w-[85%] rounded-2xl p-2.5 shadow-2xs",
                          m.isSelf
                            ? "ml-auto bg-purple-600 text-white rounded-br-xs"
                            : "mr-auto bg-white dark:bg-slate-800 border text-slate-800 dark:text-slate-100 rounded-bl-xs"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className={cn("font-bold text-[10px]", m.isSelf ? "text-purple-100" : "text-purple-600")}>
                            {m.sender} <span className="opacity-70 font-normal">({m.role})</span>
                          </span>
                          <span className={cn("text-[9px]", m.isSelf ? "text-purple-200" : "text-slate-400")}>
                            {m.time}
                          </span>
                        </div>
                        <p className="leading-snug text-xs">{m.text}</p>
                      </div>
                    ));
                  })()}
                </div>

                {/* Send Message Input */}
                <form onSubmit={handleSendMessage} className="p-2.5 border-t bg-background flex items-center gap-1.5 shrink-0">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type a team message..."
                    className="flex-1 text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-none outline-hidden focus:ring-1 focus:ring-purple-500"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="h-8 px-3 rounded-xl gradient-brand text-white text-xs font-semibold shadow-xs"
                  >
                    <Send className="size-3" />
                  </Button>
                </form>
              </div>
            )}

            {/* TAB 2: Workspace Broadcasts */}
            {activeMessageTab === "broadcasts" && (
              <div className="p-3 space-y-2.5 max-h-[380px] overflow-y-auto">
                {broadcasts.map((b) => (
                  <div key={b.id} className="p-3 rounded-xl border bg-background hover:bg-slate-50/70 transition-colors space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={cn("text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border", b.tagColor)}>
                        {b.tag}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{b.date}</span>
                    </div>
                    <h5 className="font-bold text-xs text-foreground">{b.title}</h5>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{b.body}</p>
                    <div className="text-[9.5px] text-purple-700 font-semibold pt-1 flex items-center gap-1">
                      <Megaphone className="size-2.5" /> Posted by {b.author}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 3: AI Assistant */}
            {activeMessageTab === "assistant" && (
              <div className="flex flex-col h-[380px]">
                <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
                  {aiChatHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "p-2.5 rounded-2xl max-w-[90%] leading-relaxed shadow-2xs",
                        item.sender === "user"
                          ? "ml-auto bg-purple-600 text-white rounded-br-xs"
                          : "mr-auto bg-purple-50/70 dark:bg-slate-800 border border-purple-100 text-slate-800 dark:text-slate-100 rounded-bl-xs"
                      )}
                    >
                      <div className="flex items-center gap-1 mb-1 font-bold text-[10px]">
                        {item.sender === "ai" ? (
                          <>
                            <Sparkles className="size-3 text-purple-600" />
                            <span className="text-purple-700">BusinessOS AI</span>
                          </>
                        ) : (
                          <span className="text-purple-100">You</span>
                        )}
                      </div>
                      <p>{item.text}</p>
                    </div>
                  ))}
                </div>

                {/* Quick Prompts */}
                <div className="px-3 py-1.5 flex items-center gap-1 overflow-x-auto border-t bg-slate-50/60 dark:bg-slate-900/40 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setAiAssistantInput("How do I transfer stock between workspaces?");
                    }}
                    className="text-[10px] font-medium px-2 py-0.5 bg-background border rounded-full text-slate-600 hover:text-purple-700 whitespace-nowrap cursor-pointer"
                  >
                    🔄 Inter-workspace transfer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAiAssistantInput("How to split staff per company?");
                    }}
                    className="text-[10px] font-medium px-2 py-0.5 bg-background border rounded-full text-slate-600 hover:text-purple-700 whitespace-nowrap cursor-pointer"
                  >
                    👥 Assign workspace users
                  </button>
                </div>

                {/* AI input */}
                <form onSubmit={handleSendAiAssistant} className="p-2.5 border-t bg-background flex items-center gap-1.5 shrink-0">
                  <input
                    type="text"
                    value={aiAssistantInput}
                    onChange={(e) => setAiAssistantInput(e.target.value)}
                    placeholder="Ask AI anything about this workspace..."
                    className="flex-1 text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-none outline-hidden focus:ring-1 focus:ring-purple-500"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="h-8 px-3 rounded-xl gradient-brand text-white text-xs font-semibold shadow-xs"
                  >
                    <Send className="size-3" />
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
            <button className="flex items-center gap-1.5 pl-0.5 pr-1 py-0.5 rounded-lg hover:bg-slate-50 transition cursor-pointer">
              <div className="size-7.5 rounded-full gradient-brand text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {user?.avatar || "VE"}
              </div>
              <div className="hidden 2xl:block text-left">
                <div className="text-xs font-bold text-slate-800 leading-tight flex items-center gap-0.5">
                  {user?.name || "Venkat E."}
                </div>
                <div className="text-[9.5px] text-slate-400 font-medium leading-none mt-0.5 flex items-center gap-0.5">
                  {activeRole?.name || "Super Admin"} <ChevronDown className="size-2 text-slate-400" />
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 shadow-lg">
            <div className="px-3 py-2">
              <div className="text-sm font-bold text-slate-800">{user?.name || "Venkat E."}</div>
              <div className="text-xs text-slate-500">{user?.email || "venkat@venatic.com"}</div>
              <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full">
                <ShieldCheck className="size-3" /> {activeRole?.name || "Super Admin"}
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
                  <ShieldAlert className="size-4 mr-2 text-violet-600" /> ⚡ Platform Admin (God Mode)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => { logout(); navigate({ to: "/" }); }} className="text-destructive cursor-pointer">
              <LogOut className="size-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

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
    </header>
  );
}
