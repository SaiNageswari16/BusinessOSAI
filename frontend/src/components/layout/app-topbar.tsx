import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  Bell, MessageSquare, LogOut,
  ChevronDown, Building2, ShieldCheck, Globe, Coins,
  Component, Archive, Layers, Terminal, ShoppingCart,
  ShoppingBag, Receipt, UsersRound, BarChart3, Settings,
  LayoutDashboard, RadioTower, ExternalLink, Trash2,
  CheckCheck, Search, Filter, Clock, Sparkles, Inbox,
  Eye, X, ArrowRight,
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
    icon: Receipt, 
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
    tenant: company,
    setTenant: setCompany,
    companiesList,
  } = useTenant();
  const { activeRole, availableRoles, setActiveRole, hasPermission } = useRbac();
  const navigate = useNavigate();
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activeCurrency, setActiveCurrencyState] = useState(getActiveCurrency());

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
  }, []);

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

  const handleDeleteNotification = async (notifId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await liveNotificationsApi.delete(notifId);
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
      <div className="hidden lg:flex items-center justify-center flex-1 h-full px-0.5 min-w-0 overflow-hidden">
        {visibleModules.map((mod) => {
          const isActive = currentActiveGroup === mod.group;
          const Icon = mod.icon;
          return (
            <button
              key={mod.group}
              onClick={() => handleNavigateModule(mod.defaultTo)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 flex-1 min-w-0 max-w-[82px] xl:max-w-[90px] h-full px-1 transition-all whitespace-nowrap cursor-pointer group",
                isActive
                  ? `${mod.activeBg} ${mod.activeText} font-extrabold`
                  : `text-slate-600 ${mod.hoverText} ${mod.hoverBg} font-bold`
              )}
            >
              <Icon
                className={cn(
                  "size-[18px] xl:size-[20px] transition-all group-hover:scale-110 shrink-0",
                  isActive ? `${mod.activeText} stroke-[2.4]` : `text-slate-500 stroke-[1.8] ${mod.hoverText}`
                )}
              />
              <span className={cn(
                "tracking-tight leading-none text-[11px] xl:text-[12px] truncate max-w-full text-center transition-colors",
                isActive ? `font-extrabold ${mod.activeText}` : `font-bold text-slate-700 ${mod.hoverText}`
              )}>
                {mod.label}
              </span>
              {isActive && (
                <div className={cn("absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full shadow-xs", mod.indicator)} />
              )}
            </button>
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
          <DropdownMenuContent align="end" className="w-64 shadow-xl border-purple-100">
            <DropdownMenuLabel className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Building2 className="size-3.5 text-purple-700" /> Companies & Workspaces
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {companiesList.map((c) => (
              <DropdownMenuItem key={c.id} onClick={() => setCompany(c)} className="gap-2 cursor-pointer py-2">
                <div className="size-6 rounded-md gradient-brand grid place-items-center text-white text-[10px] font-bold shrink-0">{c.logo || "CO"}</div>
                <div className="flex-1 font-semibold truncate">
                  <div className="text-xs font-bold text-slate-900 truncate">{c.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{c.industry}</div>
                </div>
                {company?.id === c.id && <div className="size-2 rounded-full bg-purple-700" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

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

        {/* Messages */}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100 relative rounded-lg" title="Messages">
          <MessageSquare className="size-3.5" />
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-purple-700" />
        </Button>

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
