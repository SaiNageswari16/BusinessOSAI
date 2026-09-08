import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { nav, NavGroup, NavItem } from "@/data/navigation";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { useRbac } from "@/contexts/rbac-context";

function matchesNavUrl(targetUrl: string, currentHref: string, currentPathname: string): boolean {
  if (!targetUrl) return false;
  const [targetPath, targetSearch] = targetUrl.split("?");

  if (targetPath !== currentPathname) {
    return false;
  }

  const currentSearchStr = currentHref.includes("?") ? currentHref.split("?")[1] : "";
  const currentParams = new URLSearchParams(currentSearchStr);

  if (!targetSearch) {
    // If target has no query params, match if current URL also has no query params
    return !currentSearchStr;
  }

  const targetParams = new URLSearchParams(targetSearch);
  for (const [key, val] of targetParams.entries()) {
    const currentVal = currentParams.get(key);
    // Special case for POS root default tab
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
  const { hasPermission } = useRbac();

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

            // No subItems, check item permission
            if (itemPerm && !hasPermission(itemPerm)) {
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
  }, [hasPermission]);

  // Find active items based on URL + Search string
  const currentPathWithSearch = location.href;
  const currentPath = location.pathname;

  // 1. First find matching group by current pathname
  let activeG = visibleNav.find(g => 
    g.items.some(it => {
      const itPath = it.to.split("?")[0];
      if (itPath === currentPath) return true;
      return it.subItems?.some(sub => sub.to.split("?")[0] === currentPath);
    })
  ) || visibleNav[0] || nav[0];


  let activeI: NavItem | undefined;
  let activeS: any;

  // 2. Refine active group, item, and subItem by exact search query match
  // First check if any subItem strictly matches
  for (const group of visibleNav) {
    for (const item of group.items) {
      if (item.subItems && item.subItems.length > 0) {
        for (const sub of item.subItems) {
          if (matchesNavUrl(sub.to, currentPathWithSearch, currentPath)) {
            activeG = group;
            activeI = item;
            activeS = sub;
            break;
          }
        }
      }
      if (activeI) break;
    }
    if (activeI) break;
  }

  // If no subItem matched, check direct items with strict match
  if (!activeI) {
    for (const group of visibleNav) {
      for (const item of group.items) {
        if (matchesNavUrl(item.to, currentPathWithSearch, currentPath)) {
          activeG = group;
          activeI = item;
          activeS = item.subItems?.[0];
          break;
        }
      }
      if (activeI) break;
    }
  }

  // 3. Fallback to first item/subitem within activeG if no item matched
  if (!activeI && activeG?.items?.length > 0) {
    activeI = activeG.items[0];
    activeS = activeG.items[0]?.subItems?.[0];
  }

  const [activeGroup, setActiveGroup] = useState<NavGroup>(activeG);
  const [activeItem, setActiveItem] = useState<NavItem>(activeI || activeG?.items?.[0]);
  const [activeSubItem, setActiveSubItem] = useState<any>(activeS);

  const isTerminal = activeGroup?.group === "POS" && activeItem?.label === "Terminal";

  useEffect(() => {
    setActiveGroup(activeG);
    if (activeI) setActiveItem(activeI);
    setActiveSubItem(activeS);
  }, [location.pathname, location.href, activeG, activeI, activeS]);

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
    setActiveItem(item);
    if (item.subItems && item.subItems.length > 0) {
      setActiveSubItem(item.subItems[0]);
      safeNavigate(item.subItems[0].to);
    } else {
      setActiveSubItem(undefined);
      safeNavigate(item.to);
    }
  };

  const handleSubItemClick = (sub: any) => {
    setActiveSubItem(sub);
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
          className="flex items-center px-6 overflow-x-auto bg-white border-b border-slate-200/90 gap-7 h-[44px] scrollbar-hide"
        >
          {activeGroup.items.map((item) => {
            const isActive = activeItem.label === item.label;
            const isHovered = hoveredItem === item.label;
            const Icon = item.icon;
            return (
              <motion.button
                key={item.label}
                whileTap={{ scale: 0.96 }}
                onMouseEnter={() => setHoveredItem(item.label)}
                onClick={() => handleItemClick(item)}
                className={cn(
                  "relative flex items-center gap-2 h-full px-2 text-[13px] transition-colors whitespace-nowrap cursor-pointer z-10",
                  isActive
                    ? "text-purple-700 font-bold"
                    : "text-slate-600 hover:text-purple-700 font-medium"
                )}
              >
                {/* Floating soft hover background */}
                {isHovered && !isActive && (
                  <motion.div
                    layoutId="ribbonSubtabHover"
                    className="absolute inset-x-0 inset-y-1.5 bg-slate-100/80 rounded-md -z-10"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                
                <Icon
                  className={cn(
                    "size-[16px] transition-transform",
                    isActive ? "text-purple-700 stroke-[2.2] scale-105" : "text-slate-400 stroke-[1.75]"
                  )}
                />
                <span>{item.label}</span>
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
          className="flex items-center px-6 py-2.5 overflow-x-auto bg-white border-b border-slate-200/80 gap-2 scrollbar-hide"
        >
          {isTerminal && (
            <div className="flex items-center">
              <button
                onClick={() => navigate({ to: '/dashboard' })}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-[12.5px] font-bold transition-all whitespace-nowrap rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-xs"
              >
                <ArrowLeft className="size-3.5" />
                Back to Dashboard
              </button>
              <div className="w-px h-4 bg-slate-200 mx-2.5" />
            </div>
          )}
          {activeItem.subItems.map((sub: any) => {
            const isActive = activeSubItem?.label === sub.label || matchesNavUrl(sub.to, currentPathWithSearch, currentPath);
            const isHovered = hoveredSubItem === sub.label;
            const SubIcon = sub.icon;
            return (
              <motion.button
                key={sub.label}
                whileTap={{ scale: 0.95 }}
                onMouseEnter={() => setHoveredSubItem(sub.label)}
                onClick={() => handleSubItemClick(sub)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3.5 py-1.5 text-[12.5px] whitespace-nowrap rounded-full cursor-pointer transition-colors z-10",
                  isActive
                    ? "text-white font-bold"
                    : "text-slate-700 hover:text-purple-900 border border-slate-200/90 bg-white font-semibold"
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
                    "size-3.5 transition-transform",
                    isActive ? "text-white stroke-[2.2] scale-105" : "text-slate-500 stroke-[2]"
                  )}
                />
                <span>{sub.label}</span>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
