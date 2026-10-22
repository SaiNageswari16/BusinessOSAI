import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ChevronDown, MapPin, Monitor, MoreHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PROFILES } from "@/lib/profiles";
import { BRANCHES, useRestaurantStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  getBadgeClasses,
  getNavBadgeValue,
  isNavItemActive,
  NAV_ITEMS_CONFIG,
  type NavBadgeCounts,
  type NavItemConfig,
} from "./nav-config";

interface HeaderNavBarProps {
  mobileNavOpen: boolean;
  onCloseMobileNav: () => void;
}

export function HeaderNavBar({ mobileNavOpen, onCloseMobileNav }: HeaderNavBarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const settings = useRestaurantStore((s) => s.settings);
  const orders = useRestaurantStore((s) => s.orders);
  const kots = useRestaurantStore((s) => s.kots);
  const ingredients = useRestaurantStore((s) => s.ingredients);
  const setBranch = useRestaurantStore((s) => s.setBranch);
  const setProfile = useRestaurantStore((s) => s.setProfile);

  const activeProfile = PROFILES[settings.profile];

  const badgeCounts: NavBadgeCounts = {
    orders: orders.filter((o) => o.status !== "completed" && o.status !== "cancelled").length,
    kitchen: kots.filter((k) => k.status !== "served").length,
    inventory: ingredients.filter((i) => i.stock <= i.reorder).length,
    delivery: orders.filter(
      (o) => o.type === "delivery" && o.status !== "completed" && o.status !== "cancelled",
    ).length,
  };

  const visibleNavItems = NAV_ITEMS_CONFIG.filter((item) =>
    activeProfile.modules.includes(item.key),
  );

  const primaryTabletItems = visibleNavItems.filter((i) => i.priority === "primary");
  const secondaryTabletItems = visibleNavItems.filter((i) => i.priority === "secondary");
  const isAnySecondaryActive = secondaryTabletItems.some((item) =>
    isNavItemActive(item, location.pathname),
  );

  const isKdsActive = location.pathname.startsWith("/kds");

  const renderNavPill = (item: NavItemConfig, extraClassName?: string) => {
    const Icon = item.icon;
    const active = isNavItemActive(item, location.pathname);
    const badgeValue = getNavBadgeValue(item.key, badgeCounts);

    return (
      <Link
        key={item.key}
        to={item.to}
        className={cn(
          "group relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-150",
          active
            ? "border border-[#38BDF8]/70 bg-gradient-to-r from-[#1769E8]/50 via-[#1769E8]/35 to-[#0B2A4A]/90 text-[#F8FAFC] shadow-[0_0_16px_rgba(34,211,238,0.28)]"
            : "border border-transparent text-[#D6E2F0] hover:border-[rgba(148,163,184,0.22)] hover:bg-white/[0.08] hover:text-white",
          extraClassName,
        )}
      >
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform group-hover:scale-105",
            active ? "text-[#22D3EE]" : item.iconColorClass,
          )}
        />
        <span>{item.label}</span>
        {badgeValue !== undefined && (
          <span
            className={cn(
              "ml-0.5 inline-flex h-4.5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none tabular",
              getBadgeClasses(item.badgeTone, active),
            )}
          >
            {badgeValue}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* ROW 2: Full-width Horizontal Navigation Bar */}
      <div className="relative bg-gradient-to-r from-[#051527]/90 via-[#092340]/90 to-[#051527]/90 backdrop-blur-md">
        <div className="mx-auto flex min-h-[48px] max-w-[1640px] items-center justify-between gap-2 px-3 py-1.5 sm:px-5 lg:px-6">
          {/* Desktop (xl+): Full 14-item Horizontal Row */}
          <nav
            aria-label="Primary Navigation"
            className="hidden xl:flex items-center gap-1 overflow-x-auto no-scrollbar"
          >
            {visibleNavItems.map((item) => renderNavPill(item))}
          </nav>

          {/* Tablet (md to xl): Primary Items + "More" Overflow Dropdown so labels never overlap */}
          <nav
            aria-label="Tablet Primary Navigation"
            className="hidden md:flex xl:hidden items-center gap-1 overflow-x-auto no-scrollbar"
          >
            {primaryTabletItems.map((item) => renderNavPill(item))}

            {secondaryTabletItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all",
                      isAnySecondaryActive
                        ? "border border-[#38BDF8]/70 bg-gradient-to-r from-[#1769E8]/50 to-[#0B2A4A]/90 text-[#F8FAFC] shadow-[0_0_14px_rgba(34,211,238,0.25)]"
                        : "border border-[rgba(148,163,184,0.22)] bg-[#0B2A4A]/65 text-[#D6E2F0] hover:bg-white/[0.1] hover:text-white",
                    )}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5 text-[#22D3EE]" />
                    <span>More</span>
                    <ChevronDown className="h-3 w-3 opacity-70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    More RestaurantOS Modules
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {secondaryTabletItems.map((item) => {
                    const Icon = item.icon;
                    const badgeVal = getNavBadgeValue(item.key, badgeCounts);
                    const active = isNavItemActive(item, location.pathname);
                    return (
                      <DropdownMenuItem
                        key={item.key}
                        onClick={() => navigate({ to: item.to })}
                        className={cn(
                          "flex items-center justify-between text-xs cursor-pointer",
                          active && "bg-primary/10 font-semibold text-primary",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </span>
                        {badgeVal !== undefined && (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                            {badgeVal}
                          </span>
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          {/* Mobile (< md): Horizontally scrollable compact navigation strip */}
          <nav
            aria-label="Mobile Horizontal Navigation"
            className="flex md:hidden items-center gap-1 overflow-x-auto py-0.5 no-scrollbar flex-1"
          >
            {visibleNavItems.map((item) => renderNavPill(item, "px-2.5 py-1"))}
          </nav>

          {/* Far Right: Distinct KDS Display Action Button */}
          <div className="shrink-0 pl-1">
            <Link
              to="/kds"
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-extrabold tracking-wide whitespace-nowrap transition-all",
                isKdsActive
                  ? "border-[#FBBF24] bg-gradient-to-r from-[#B45309] via-[#D97706] to-[#F59E0B] text-white shadow-[0_0_18px_rgba(245,158,11,0.5)]"
                  : "border-[#F59E0B]/55 bg-gradient-to-r from-[#78350F]/90 via-[#9A3412]/85 to-[#B45309]/90 text-[#FEF3C7] shadow-[0_2px_10px_rgba(245,158,11,0.22)] hover:border-[#FBBF24] hover:brightness-110 hover:text-white",
              )}
            >
              <Monitor className="h-3.5 w-3.5 text-[#FBBF24]" />
              <span className="hidden sm:inline">KDS Display</span>
              <span className="sm:hidden">KDS</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile Expandable Drawer Panel */}
      {mobileNavOpen && (
        <div className="border-t border-[rgba(148,163,184,0.22)] bg-[#071B32] px-4 py-3.5 lg:hidden">
          {/* Mobile Branch & Profile Context Bar */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[rgba(148,163,184,0.22)] bg-[#0B2A4A]/70 px-3 py-2 text-xs text-[#F8FAFC]">
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-[#22D3EE]" />
              <span className="font-semibold">{settings.branch}</span>
              <span className="text-[#B9C7D8]">· {activeProfile.label}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {BRANCHES.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => {
                    setBranch(b);
                    toast.success(`Switched branch to ${b}`);
                  }}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[10px] font-medium",
                    settings.branch === b
                      ? "bg-[#1769E8] text-white"
                      : "bg-white/10 text-[#B9C7D8]",
                  )}
                >
                  {b.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Grid Navigation */}
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(item, location.pathname);
              const badgeVal = getNavBadgeValue(item.key, badgeCounts);
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  onClick={onCloseMobileNav}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                    active
                      ? "border-[#38BDF8]/60 bg-[#1769E8]/35 text-white"
                      : "border-[rgba(148,163,184,0.15)] bg-[#0B2A4A]/50 text-[#D6E2F0] hover:bg-[#0B2A4A]",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", item.iconColorClass)} />
                    <span>{item.label}</span>
                  </span>
                  {badgeVal !== undefined && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                        getBadgeClasses(item.badgeTone, active),
                      )}
                    >
                      {badgeVal}
                    </span>
                  )}
                </Link>
              );
            })}

            <Link
              to="/ai"
              onClick={onCloseMobileNav}
              className="flex items-center gap-2 rounded-xl border border-[#8B5CF6]/40 bg-gradient-to-r from-[#7C3AED]/40 to-[#C026D3]/40 px-3 py-2 text-xs font-bold text-white"
            >
              <Sparkles className="h-4 w-4 text-[#C084FC]" />
              <span>AI Co-Pilot</span>
            </Link>

            <Link
              to="/kds"
              onClick={onCloseMobileNav}
              className="flex items-center gap-2 rounded-xl border border-[#F59E0B]/50 bg-gradient-to-r from-[#9A3412]/70 to-[#B45309]/70 px-3 py-2 text-xs font-bold text-[#FEF3C7]"
            >
              <Monitor className="h-4 w-4 text-[#FBBF24]" />
              <span>KDS Display</span>
            </Link>
          </div>

          {/* Mobile Quick Profile Switcher */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[rgba(148,163,184,0.18)] pt-2.5">
            <span className="text-[11px] text-[#B9C7D8] mr-1">Format:</span>
            {Object.values(PROFILES).map((prof) => (
              <button
                key={prof.id}
                type="button"
                onClick={() => {
                  setProfile(prof.id);
                  toast.success(`Switched format to ${prof.label}`);
                }}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                  settings.profile === prof.id
                    ? "bg-[#22D3EE] text-[#071B32]"
                    : "bg-white/10 text-[#B9C7D8]",
                )}
              >
                {prof.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
