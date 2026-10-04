import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { nav, NavGroup, NavItem } from "@/data/navigation";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { useRbac } from "@/contexts/rbac-context";
import { useI18n } from "@/contexts/i18n-context";

function matchesNavUrl(targetUrl: string, currentPathname: string, searchParams: URLSearchParams): boolean {
  if (!targetUrl) return false;
  const [targetPath, targetSearch] = targetUrl.split("?");

  if (targetPath !== currentPathname) {
    return false;
  }

  if (!targetSearch) {
    const currentTab = searchParams.get("tab");
    return !currentTab;
  }

  const targetParams = new URLSearchParams(targetSearch);
  for (const [key, val] of targetParams.entries()) {
    const currentVal = searchParams.get(key);
    if (key === "tab" && !currentVal && val === "sales_history" && currentPathname === "/pos") {
      continue;
    }
    if (currentVal !== val) {
      return false;
    }
  }

  return true;
}

export function RibbonNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission, isTabAllowed } = useRbac();
  const { t } = useI18n();

  // Filter nav groups and sub-items to only those the user is permitted to see
  const visibleNav = useMemo(() => {
    return nav
      .filter((group) => !group.permission || hasPermission(group.permission))
      .map((group) => {
        const filteredItems = group.items
          .map((item) => {
            const itemPerm = item.permission || group.permission;

            if (item.subItems && item.subItems.length > 0) {
              const filteredSubItems = item.subItems.filter((s) => {
                const subPerm = s.permission || item.permission || group.permission;
                if (subPerm && !hasPermission(subPerm)) return false;
                if (!isTabAllowed(s.to)) return false;
                return true;
              });

              if (filteredSubItems.length === 0) {
                return null;
              }

              return {
                ...item,
                subItems: filteredSubItems,
              };
            }

            // No subItems, check item permission and tab allowance
            if (itemPerm && !hasPermission(itemPerm)) {
              return null;
            }
            if (!isTabAllowed(item.to)) {
              return null;
            }

            return item;
          })
          .filter((item): item is NavItem => item !== null);

        return {
          ...group,
          items: filteredItems,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [hasPermission, isTabAllowed]);

  const currentPath = location.pathname;
  const searchParams = useMemo(() => {
    if (location.search && typeof location.search === "object") {
      const sp = new URLSearchParams();
      Object.entries(location.search as Record<string, any>).forEach(([k, v]) => {
        if (v !== undefined && v !== null) sp.set(k, String(v));
      });
      return sp;
    }
    const rawSearch = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
    return new URLSearchParams(rawSearch);
  }, [location.search, location.pathname]);

  const { activeGroup, activeItem, activeSubItem } = useMemo(() => {
    let matchedG: NavGroup | undefined;
    let matchedI: NavItem | undefined;
    let matchedS: any;

    // 1. High priority: Check exact subItem matches across all visible nav groups
    for (const group of visibleNav) {
      for (const item of group.items) {
        if (item.subItems && item.subItems.length > 0) {
          for (const sub of item.subItems) {
            if (matchesNavUrl(sub.to, currentPath, searchParams)) {
              matchedG = group;
              matchedI = item;
              matchedS = sub;
              break;
            }
          }
        }
        if (matchedI) break;
      }
      if (matchedI) break;
    }

    // 2. Medium priority: Check direct item matches
    if (!matchedI) {
      for (const group of visibleNav) {
        for (const item of group.items) {
          if (matchesNavUrl(item.to, currentPath, searchParams)) {
            matchedG = group;
            matchedI = item;
            matchedS = item.subItems?.[0];
            break;
          }
        }
        if (matchedI) break;
      }
    }

    // 3. Fallback: Find matching group by current pathname only
    if (!matchedG) {
      matchedG = visibleNav.find(g => 
        g.items.some(it => {
          const itPath = it.to.split("?")[0];
          if (itPath === currentPath) return true;
          return it.subItems?.some(sub => sub.to.split("?")[0] === currentPath);
        })
      ) || visibleNav[0] || nav[0];
    }

    // 4. Fallback item within matchedG
    if (!matchedI && matchedG?.items?.length > 0) {
      matchedI = matchedG.items[0];
      matchedS = matchedG.items[0]?.subItems?.[0];
    }

    const fallbackG = matchedG || visibleNav[0] || nav[0];
    const fallbackI = matchedI || fallbackG?.items?.[0] || nav[0].items[0];
    const fallbackS = matchedS || fallbackI?.subItems?.[0];

    return {
      activeGroup: fallbackG,
      activeItem: fallbackI,
      activeSubItem: fallbackS,
    };
  }, [visibleNav, currentPath, searchParams]);

  const isTerminal = activeGroup?.group === "POS" && activeItem?.label === "Terminal";

  const safeNavigate = (targetUrl: string) => {
    if (!targetUrl) return;
    const [path, searchStr] = targetUrl.split("?");
    const search: Record<string, string> = {};
    if (searchStr) {
      const params = new URLSearchParams(searchStr);
      params.forEach((value, key) => {
        search[key] = value;
      });
    }
    void navigate({ to: path, search });
  };

  const handleItemClick = (item: NavItem) => {
    if (item.subItems && item.subItems.length > 0) {
      safeNavigate(item.subItems[0].to);
    } else {
      safeNavigate(item.to);
    }
  };

  const handleSubItemClick = (sub: any) => {
    safeNavigate(sub.to);
  };

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [hoveredSubItem, setHoveredSubItem] = useState<string | null>(null);

  if (!activeGroup || !activeItem) return null;

  return (
    <div className="flex flex-col w-full shrink-0 bg-white z-40 relative no-print select-none">
      {/* ── Row 1: Section Sub-Navigation Tabs (Level 2) ── */}
      {!isTerminal && activeGroup.items.length > 0 && (
        <div 
          onMouseLeave={() => setHoveredItem(null)}
          className="flex items-center px-2 sm:px-3 lg:px-4 overflow-x-auto bg-white border-b border-slate-200/90 gap-0.5 sm:gap-1 lg:gap-1.5 h-[40px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {activeGroup.items.map((item) => {
            const isActive = activeItem.label === item.label;
            const isHovered = hoveredItem === item.label;
            const isHighlighted = (item as any).isHighlighted;
            const Icon = item.icon;
            return (
              <motion.button
                key={item.label}
                whileTap={{ scale: 0.96 }}
                onMouseEnter={() => setHoveredItem(item.label)}
                onClick={() => handleItemClick(item)}
                className={cn(
                  "relative flex items-center gap-1.5 h-full px-2 lg:px-2.5 text-[12px] xl:text-[12.5px] transition-colors whitespace-nowrap cursor-pointer z-10 shrink-0",
                  isActive
                    ? "text-purple-700 font-bold"
                    : isHighlighted
                    ? "text-purple-700 font-bold bg-purple-50/90 hover:bg-purple-100/90 rounded-md my-1 px-2.5 py-0.5 border border-purple-200 shadow-xs"
                    : "text-slate-600 hover:text-purple-700 font-medium"
                )}
              >
                {/* Floating soft hover background */}
                {isHovered && !isActive && !isHighlighted && (
                  <motion.div
                    layoutId="ribbonSubtabHover"
                    className="absolute inset-x-0 inset-y-1.5 bg-slate-100/80 rounded-md -z-10"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                
                <Icon
                  className={cn(
                    "size-[14px] xl:size-[15px] transition-transform shrink-0",
                    isActive
                      ? "text-purple-700 stroke-[2.2] scale-105"
                      : isHighlighted
                      ? "text-purple-600 stroke-[2]"
                      : "text-slate-400 stroke-[1.75]"
                  )}
                />
                <span>{t(item.label, item.label)}</span>
                
                {isHighlighted && !isActive && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse ml-0.5" />
                )}

                {isActive && (
                  <motion.div
                    layoutId="activeRibbonSubtab"
                    className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-purple-700 rounded-t-full shadow-[0_-1px_6px_rgba(124,58,237,0.35)]"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* ── Row 2: Feature Ribbon / Pills Bar (Level 3) ── */}
      {activeItem.subItems && activeItem.subItems.length > 0 && (
        <div 
          onMouseLeave={() => setHoveredSubItem(null)}
          className="flex items-center px-2 sm:px-3 lg:px-4 py-1.5 overflow-x-auto bg-white border-b border-slate-200/80 gap-1 sm:gap-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {isTerminal && (
            <div className="flex items-center">
              <button
                onClick={() => navigate({ to: '/dashboard' })}
                className="flex items-center gap-1.5 px-3 py-1 text-[12px] font-bold transition-all whitespace-nowrap rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-xs shrink-0"
              >
                <ArrowLeft className="size-3.5" />
                {t("Dashboard", "Dashboard")}
              </button>
              <div className="w-px h-4 bg-slate-200 mx-2" />
            </div>
          )}
          {activeItem.subItems.map((sub: any) => {
            const isActive = activeSubItem?.label === sub.label;
            const isHovered = hoveredSubItem === sub.label;
            const SubIcon = sub.icon;
            return (
              <motion.button
                key={sub.label}
                whileTap={{ scale: 0.95 }}
                onMouseEnter={() => setHoveredSubItem(sub.label)}
                onClick={() => handleSubItemClick(sub)}
                className={cn(
                  "relative flex items-center gap-1.5 px-2.5 py-1 text-[12px] whitespace-nowrap rounded-full cursor-pointer transition-colors z-10 shrink-0",
                  isActive
                    ? "text-white font-bold"
                    : "text-slate-700 hover:text-purple-900 border border-slate-200/90 bg-white font-medium"
                )}
              >
                {/* Active Pill Spring Indicator */}
                {isActive && (
                  <motion.div
                    layoutId={`activeRibbonPill_${activeItem.label}`}
                    className="absolute inset-0 bg-gradient-to-r from-purple-700 to-purple-800 rounded-full shadow-sm ring-1 ring-purple-800 -z-10"
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                  />
                )}

                {/* Hover Aura on Inactive Pills */}
                {isHovered && !isActive && (
                  <motion.div
                    layoutId={`hoverRibbonPill_${activeItem.label}`}
                    className="absolute inset-0 bg-purple-50/70 border border-purple-200/80 rounded-full -z-10"
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  />
                )}

                <SubIcon
                  className={cn(
                    "size-3.5 transition-transform shrink-0",
                    isActive ? "text-white stroke-[2.2] scale-105" : "text-slate-500 stroke-[2]"
                  )}
                />
                <span>{t(sub.label, sub.label)}</span>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
