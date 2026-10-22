import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  ChefHat,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  MapPin,
  Menu as MenuIcon,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { minutesSince } from "@/lib/calc";
import { PROFILES } from "@/lib/profiles";
import { BRANCHES, useRestaurantStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface HeaderBrandBarProps {
  mobileNavOpen: boolean;
  onToggleMobileNav: () => void;
  onOpenSearch: () => void;
  onOpenHelp: () => void;
  onOpenResetConfirm: () => void;
  onNewOrder: () => void;
}

export function HeaderBrandBar({
  mobileNavOpen,
  onToggleMobileNav,
  onOpenSearch,
  onOpenHelp,
  onOpenResetConfirm,
  onNewOrder,
}: HeaderBrandBarProps) {
  const navigate = useNavigate();

  const settings = useRestaurantStore((s) => s.settings);
  const notices = useRestaurantStore((s) => s.notices);
  const setBranch = useRestaurantStore((s) => s.setBranch);
  const setProfile = useRestaurantStore((s) => s.setProfile);
  const toggleDark = useRestaurantStore((s) => s.toggleDark);
  const markNoticeRead = useRestaurantStore((s) => s.markNoticeRead);
  const markAllNoticesRead = useRestaurantStore((s) => s.markAllNoticesRead);

  const activeProfile = PROFILES[settings.profile];
  const unreadNotices = notices.filter((n) => !n.read).length;

  return (
    <div className="relative border-b border-[rgba(148,163,184,0.22)]">
      <div className="mx-auto flex min-h-[62px] max-w-[1640px] items-center justify-between gap-2.5 px-3 py-2 sm:px-5 lg:gap-4 lg:px-6">
        {/* LEFT: Brand, Restaurant Context & Branch Selector */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
          <button
            type="button"
            onClick={onToggleMobileNav}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(148,163,184,0.22)] bg-[#0B2A4A]/80 text-[#F8FAFC] transition-colors hover:border-[#22D3EE]/50 hover:bg-[#0B2A4A] lg:hidden"
            aria-label="Toggle navigation menu"
          >
            {mobileNavOpen ? <X className="h-4.5 w-4.5" /> : <MenuIcon className="h-4.5 w-4.5" />}
          </button>

          {/* Brand Logo + RestaurantOS Title + Sunrise Restaurant Subtitle */}
          <Link to="/" className="group flex items-center gap-2.5 focus:outline-none">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[#22D3EE]/25 via-[#1769E8]/35 to-[#0B2A4A] border border-[#22D3EE]/45 shadow-[0_0_16px_rgba(34,211,238,0.22)] transition-transform group-hover:scale-105">
              <ChefHat className="h-5.5 w-5.5 text-white drop-shadow-[0_2px_6px_rgba(34,211,238,0.6)]" />
              <span className="absolute -bottom-0.5 h-1 w-5 rounded-full bg-[#22D3EE]" />
            </div>

            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-[#F8FAFC] sm:text-[18px]">
                  Restaurant<span className="text-[#22D3EE]">OS</span>
                </span>
                <span className="hidden rounded-full border border-[#22D3EE]/30 bg-[#0B2A4A]/90 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#22D3EE] xl:inline-block">
                  {activeProfile.label}
                </span>
              </div>
              <div className="text-[11px] font-medium text-[#B9C7D8]">{settings.restaurant}</div>
            </div>
          </Link>

          <div className="hidden h-7 w-px bg-[rgba(148,163,184,0.22)] sm:block" />

          {/* Branch Selector Pill */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="hidden sm:inline-flex items-center gap-2 rounded-full border border-[#22D3EE]/35 bg-[#0B2A4A]/85 px-3.5 py-1.5 text-xs font-semibold text-[#F8FAFC] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all hover:border-[#22D3EE]/65 hover:bg-[#0F355C]"
              >
                <MapPin className="h-3.5 w-3.5 text-[#22D3EE] shrink-0" />
                <span className="truncate max-w-[130px] md:max-w-none">{settings.branch}</span>
                <ChevronDown className="h-3.5 w-3.5 text-[#B9C7D8]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Branch Location ({settings.restaurant})
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {BRANCHES.map((branch) => (
                <DropdownMenuItem
                  key={branch}
                  onClick={() => {
                    setBranch(branch);
                    toast.success(`Switched active branch to ${branch}`);
                  }}
                  className="flex items-center justify-between text-xs cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {branch}
                  </span>
                  {settings.branch === branch && (
                    <Badge variant="secondary" className="text-[10px]">
                      Active
                    </Badge>
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Restaurant Format Profile
              </DropdownMenuLabel>
              {Object.values(PROFILES).map((prof) => (
                <DropdownMenuItem
                  key={prof.id}
                  onClick={() => {
                    setProfile(prof.id);
                    toast.success(`Switched format to ${prof.label}`);
                  }}
                  className="flex items-center justify-between text-xs cursor-pointer"
                >
                  <span>{prof.label}</span>
                  {settings.profile === prof.id && (
                    <Badge variant="outline" className="text-[10px]">
                      Current
                    </Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* CENTER: Prominent Pill Global Search Bar */}
        <div className="hidden md:flex flex-1 max-w-xl mx-2">
          <button
            type="button"
            onClick={onOpenSearch}
            className={cn(
              "group flex h-10 w-full items-center justify-between rounded-full px-4 text-xs transition-all border",
              settings.dark
                ? "border-[rgba(148,163,184,0.28)] bg-[#0B2A4A]/90 text-[#B9C7D8] hover:border-[#22D3EE]/50 hover:text-[#F8FAFC]"
                : "border-white/40 bg-[#DCE7F9]/95 text-[#1E3A5F] shadow-inner hover:bg-white hover:text-[#071B32]",
            )}
          >
            <span className="flex items-center gap-2.5 truncate">
              <Search
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  settings.dark ? "text-[#22D3EE]" : "text-[#1769E8]",
                )}
              />
              <span className="truncate font-medium">
                Search tables, dishes, orders, guests or jump to screen...
              </span>
            </span>
            <kbd className="ml-3 inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-[#4338CA] to-[#6366F1] px-2.5 py-0.5 font-sans text-[11px] font-bold text-white shadow-xs">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* RIGHT: Global Actions, Notifications, Help, Theme & User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mobile/Compact Search Button */}
          <button
            type="button"
            onClick={onOpenSearch}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(148,163,184,0.22)] bg-[#0B2A4A]/85 text-[#F8FAFC] transition-colors hover:border-[#22D3EE]/50 md:hidden"
            aria-label="Open global search"
          >
            <Search className="h-4 w-4 text-[#22D3EE]" />
          </button>

          {/* Primary Action: + New Order */}
          <button
            type="button"
            onClick={onNewOrder}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-[#1769E8] via-[#2563EB] to-[#6366F1] px-3.5 sm:px-4 text-xs font-bold text-white shadow-[0_2px_12px_rgba(23,105,232,0.45)] border border-white/20 transition-all hover:brightness-110 active:scale-[0.99]"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span className="hidden sm:inline">New Order</span>
          </button>

          {/* Secondary Action: AI Co-Pilot */}
          <button
            type="button"
            onClick={() => navigate({ to: "/ai" })}
            className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#C026D3] px-3.5 sm:px-4 text-xs font-bold text-white shadow-[0_2px_12px_rgba(139,92,246,0.4)] border border-white/20 transition-all hover:brightness-110 active:scale-[0.99]"
          >
            <Sparkles className="h-3.5 w-3.5 fill-white/80 text-white" />
            <span>AI Co-Pilot</span>
          </button>

          {/* Notification Bell with Unread Badge */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(148,163,184,0.22)] bg-[#0B2A4A]/85 text-[#F8FAFC] transition-colors hover:border-[#22D3EE]/50 hover:bg-[#0F355C]"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadNotices > 0 && (
                  <span className="absolute -top-1 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#EF4444] px-1 text-[10px] font-extrabold text-white shadow-xs ring-2 ring-[#071B32]">
                    {unreadNotices}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
                <div>
                  <div className="text-xs font-semibold">Operational Alerts</div>
                  <div className="text-[11px] text-muted-foreground">
                    {unreadNotices} unread notifications
                  </div>
                </div>
                {unreadNotices > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => markAllNoticesRead()}
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                  </Button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-border">
                {notices.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No notifications yet
                  </div>
                ) : (
                  notices.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => markNoticeRead(n.id)}
                      className={cn(
                        "flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left text-xs transition-colors hover:bg-muted/60",
                        !n.read && "bg-primary/5",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1 h-2 w-2 shrink-0 rounded-full",
                          n.tone === "warning"
                            ? "bg-warning"
                            : n.tone === "success"
                              ? "bg-success"
                              : "bg-primary",
                        )}
                      />
                      <div className="flex-1 space-y-0.5">
                        <div className={cn("leading-snug", !n.read && "font-medium")}>{n.text}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {minutesSince(n.at)}m ago
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Help Action */}
          <button
            type="button"
            onClick={onOpenHelp}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(148,163,184,0.22)] bg-[#0B2A4A]/85 text-[#B9C7D8] transition-colors hover:border-[#22D3EE]/50 hover:bg-[#0F355C] hover:text-[#F8FAFC]"
            aria-label="Help & Shortcuts"
            title="Operations Guide & Shortcuts"
          >
            <CircleHelp className="h-4 w-4" />
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={() => toggleDark()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(148,163,184,0.22)] bg-[#0B2A4A]/85 text-[#B9C7D8] transition-colors hover:border-[#22D3EE]/50 hover:bg-[#0F355C] hover:text-[#F8FAFC]"
            aria-label="Toggle theme"
            title={settings.dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {settings.dark ? (
              <Sun className="h-4 w-4 text-[#F59E0B]" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          {/* User Avatar + Name & Role + Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2.5 rounded-full border border-[rgba(148,163,184,0.22)] bg-[#0B2A4A]/80 py-1 pr-2.5 pl-1 text-left transition-colors hover:border-[#22D3EE]/50 hover:bg-[#0F355C]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#22D3EE] to-[#0284C7] text-xs font-extrabold text-white shadow-xs">
                  RK
                </div>
                <div className="hidden lg:block leading-tight">
                  <div className="text-xs font-bold text-[#F8FAFC]">Ravi Kumar</div>
                  <div className="text-[10px] font-medium text-[#B9C7D8]">Manager</div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-[#B9C7D8]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-xs font-semibold">Ravi Kumar</div>
                <div className="text-[11px] font-normal text-muted-foreground">
                  Restaurant Manager · {settings.branch}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                <SettingsIcon className="mr-2 h-4 w-4" />
                Restaurant Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/staff" })}>
                <UserCheck className="mr-2 h-4 w-4" />
                Staff & Shifts
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenHelp}>
                <CircleHelp className="mr-2 h-4 w-4" />
                Workflow Guide & Shortcuts
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onOpenResetConfirm}
                className="text-destructive focus:text-destructive"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset Demo Data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
