import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Search, Bell, MessageSquare, Settings, LogOut, Plus,
  Command as CommandIcon, ChevronDown, Building2, GitBranch, Sparkles, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/auth-context";
import { useTenant } from "@/contexts/tenant-context";
import { useRbac } from "@/contexts/rbac-context";
import { notifications } from "@/data/mock";
import { CommandPalette } from "@/components/command-palette";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { liveNotificationsApi, LiveNotification } from "@/lib/api-client";
import { toast } from "sonner";

export function AppTopbar() {
  const { user, logout } = useAuth();
  const {
    tenant: company,
    setTenant: setCompany,
    activeBranch,
    setActiveBranch,
    companiesList,
    branchesList,
  } = useTenant();
  const { activeRole, availableRoles, setActiveRole } = useRbac();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(i);
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
    const timer = setInterval(() => fetchLiveNotifications(false), 6000);
    return () => clearInterval(timer);
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
    created_at: new Date(Date.now() - 600000).toISOString(), // Mock timestamp
    category: "system"
  }));

  const unreadCount = activeNotifs.filter((n) => n.unread).length;

  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between border-b border-border bg-white px-4 lg:px-6 shadow-sm">
      {/* Brand / Logo */}
      <div className="flex items-center gap-2 mr-2">
        <div className="size-8 shrink-0 rounded-lg gradient-brand grid place-items-center text-white shadow-elegant">
          <Sparkles className="size-4" />
        </div>
        <div className="hidden lg:block overflow-hidden">
          <div className="font-bold tracking-tight text-foreground leading-none">BusinessOS AI</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">AI Edition</div>
        </div>
      </div>

      {/* Company / Branch switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-1.5 px-1.5 h-10">
            <div className="size-7 rounded-md gradient-brand grid place-items-center text-white text-xs font-bold">
              {company.logo}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold leading-tight">{company.name}</div>
              <div className="text-[10px] text-muted-foreground leading-tight">{company.industry}</div>
            </div>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="flex items-center gap-2"><Building2 className="size-3.5" /> Companies</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {companiesList.map((c) => (
            <DropdownMenuItem key={c.id} onClick={() => setCompany(c)} className="gap-2">
              <div className="size-6 rounded gradient-brand grid place-items-center text-white text-[10px] font-bold">{c.logo}</div>
              <div className="flex-1 font-semibold truncate">
                <div className="text-sm truncate">{c.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{c.industry}</div>
              </div>
              {company.id === c.id && <div className="size-1.5 rounded-full bg-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="hidden lg:flex items-center text-muted-foreground">/</div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="hidden lg:inline-flex gap-1.5 px-1.5 h-10 text-sm font-medium">
            <GitBranch className="size-3.5 text-muted-foreground" />
            {activeBranch ? `${activeBranch.name} (${activeBranch.code})` : "Select Branch"}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto">
          <DropdownMenuLabel>Branches</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {branchesList.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground text-center">No active branches</div>
          ) : (
            branchesList.map((b) => (
              <DropdownMenuItem key={b.id} onClick={() => setActiveBranch(b)} className="flex items-center justify-between">
                <span>{b.name} <span className="text-[10px] text-muted-foreground font-mono">({b.code})</span></span>
                {activeBranch?.id === b.id && <div className="size-1.5 rounded-full bg-primary" />}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="hidden lg:flex items-center text-muted-foreground">/</div>

      {/* Role Switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="hidden lg:inline-flex gap-1.5 px-1.5 h-10 text-sm font-medium">
            <ShieldCheck className="size-3.5 text-primary" />
            {activeRole?.name || "Select Role"}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
          <DropdownMenuLabel>Switch Role (Portal)</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {availableRoles.map((r) => (
            <DropdownMenuItem key={r.id} onClick={() => setActiveRole(r)} className="gap-2">
              <div className="flex-1">
                <div className="text-sm">{r.name}</div>
                <div className="text-[10px] text-muted-foreground line-clamp-1">{r.description}</div>
              </div>
              {activeRole?.id === r.id && <div className="size-1.5 rounded-full bg-primary shrink-0" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Search */}
      <button
        onClick={() => setPaletteOpen(true)}
        className="flex-1 max-w-3xl ml-4 h-9 px-3 rounded-lg border border-border bg-white hover:border-blue-400 focus:outline-none transition-all flex items-center justify-between gap-2 text-sm text-muted-foreground shadow-sm"
      >
        <div className="flex items-center gap-2">
          <Search className="size-4" />
          <span className="hidden sm:inline">Search anything — orders, products, people…</span>
        </div>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <div className="flex items-center gap-1">


        {/* Date/Time */}
        <div className="hidden xl:flex flex-col items-end px-3 border-l ml-2">
          <div className="text-xs font-semibold">{format(now, "EEE, MMM d")}</div>
          <div className="text-[10px] text-muted-foreground">{format(now, "h:mm a")} · UTC−7</div>
        </div>

        {/* Messages */}
        <Button variant="ghost" size="icon" className="h-9 w-9 relative">
          <MessageSquare className="size-4" />
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
        </Button>

        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold grid place-items-center">
                  {unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-semibold text-sm">Notifications</div>
              <button 
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline bg-transparent border-none cursor-pointer"
              >
                Mark all read
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {activeNotifs.map((n) => {
                let timeStr = "recently";
                try {
                  timeStr = format(new Date(n.created_at), "MMM d, h:mm a");
                } catch {}
                return (
                  <div key={n.id} className={cn("px-4 py-3 border-b last:border-0 hover:bg-muted/40 cursor-pointer", n.unread && "bg-primary/[0.04]")}>
                    <div className="flex items-start gap-2">
                      {n.unread && <div className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{n.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>
                        <div className="text-[10px] text-muted-foreground mt-1">{timeStr}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* User */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-muted transition">
              <Avatar className="size-8">
                <AvatarFallback className="gradient-brand text-white text-xs font-semibold">
                  {user?.avatar ?? "AC"}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <div className="px-3 py-2">
              <div className="text-sm font-semibold">{user?.name}</div>
              <div className="text-xs text-muted-foreground">{user?.email}</div>
              <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                <ShieldCheck className="size-3" /> {activeRole?.name}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem><Settings className="size-4 mr-2" /> Workspace settings</DropdownMenuItem>
            <DropdownMenuItem><Building2 className="size-4 mr-2" /> Switch workspace</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { logout(); navigate({ to: "/" }); }} className="text-destructive">
              <LogOut className="size-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}

// Hide scrollbar utility (used in sidebar)
declare module "react" {}

// Discard – ensure Input is referenced if needed
void Input;
