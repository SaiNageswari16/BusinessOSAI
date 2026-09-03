import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  Bell, MessageSquare, LogOut,
  ChevronDown, Building2, ShieldCheck, Globe, Coins,
  Component, Archive, Layers, Terminal, ShoppingCart,
  ShoppingBag, Receipt, UsersRound, BarChart3, Settings,
  LayoutDashboard,
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
    group: "Analytics & Intelligence", 
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
    group: "System Configuration", 
    label: "System Config", 
    icon: Settings, 
    defaultTo: "/settings?tab=company_profile", 
    permission: "manage:system_admin",
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

  const activeNotifs = liveNotifications.length > 0 ? liveNotifications : notifications.map(n => ({
    id: n.id,
    title: n.title,
    body: n.body,
    unread: n.unread,
    created_at: new Date(Date.now() - 600000).toISOString(),
    category: "system"
  }));

  const unreadCount = activeNotifs.filter((n) => n.unread).length || 1;

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
          <PopoverContent align="end" className="w-80 p-0 shadow-lg">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-semibold text-sm">Notifications</div>
              <button 
                onClick={handleMarkAllRead}
                className="text-xs text-purple-700 font-semibold hover:underline bg-transparent border-none cursor-pointer"
              >
                Mark all read
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {activeNotifs.map((n) => (
                <div key={n.id} className={cn("px-4 py-3 border-b last:border-0 hover:bg-slate-50 cursor-pointer", n.unread && "bg-purple-50/40")}>
                  <div className="flex items-start gap-2">
                    {n.unread && <div className="size-1.5 rounded-full bg-purple-700 mt-1.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{n.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>
                    </div>
                  </div>
                </div>
              ))}
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
    </header>
  );
}
