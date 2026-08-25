import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { nav, NavGroup, NavItem } from "@/data/navigation";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { useRbac } from "@/contexts/rbac-context";

export function RibbonNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = useRbac();

  // Filter nav groups to only those the user is permitted to see
  const visibleNav = useMemo(() => {
    return nav.filter((group) => {
      if (!group.permission) return true;
      return hasPermission(group.permission);
    });
  }, [hasPermission]);

  // Find active items based on URL + Search string
  const currentPathWithSearch = location.href;
  const currentPath = location.pathname;

  let activeG = visibleNav.find(g => g.group === "Core ERP") || visibleNav[0] || nav[0];
  let activeI = activeG?.items[0];
  let activeS = activeG?.items[0]?.subItems?.[0];

  for (const group of visibleNav) {
    for (const item of group.items) {
      if (item.subItems) {
        for (const sub of item.subItems) {
          if (currentPathWithSearch.includes(sub.to)) {
            activeG = group;
            activeI = item;
            activeS = sub;
          }
        }
      } else {
        if (currentPathWithSearch.includes(item.to)) {
          activeG = group;
          activeI = item;
          activeS = undefined;
        }
      }
    }
  }

  // Fallback to pathname matching if no search param match
  if (!activeG || (activeG === visibleNav[0] && location.pathname !== "/dashboard")) {
    for (const group of visibleNav) {
      for (const item of group.items) {
        if (item.subItems) {
          for (const sub of item.subItems) {
            if (sub.to.startsWith(currentPath)) {
              activeG = group;
              activeI = item;
              activeS = sub;
              break;
            }
          }
        } else {
          if (item.to.startsWith(currentPath)) {
            activeG = group;
            activeI = item;
            activeS = undefined;
            break;
          }
        }
      }
    }
  }

  const [activeGroup, setActiveGroup] = useState<NavGroup>(activeG);
  const [activeItem, setActiveItem] = useState<NavItem>(activeI);
  const [activeSubItem, setActiveSubItem] = useState<any>(activeS);

  const isTerminal = activeGroup?.group === "POS" && activeItem?.label === "Terminal";

  useEffect(() => {
    setActiveGroup(activeG);
    setActiveItem(activeI);
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

  if (!activeGroup || !activeItem) return null;

  return (
    <div className="flex flex-col w-full shrink-0 bg-white z-40 relative no-print select-none">
      {/* ── Row 1: Section Sub-Navigation Tabs (Level 2) ── */}
      {!isTerminal && activeGroup.items.length > 0 && (
        <div className="flex items-center px-6 overflow-x-auto bg-white border-b border-slate-200/90 gap-8 h-[44px] scrollbar-hide">
          {activeGroup.items.map((item) => {
            const isActive = activeItem.label === item.label;
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => handleItemClick(item)}
                className={cn(
                  "relative flex items-center gap-2 h-full px-1 text-[13px] transition-colors whitespace-nowrap cursor-pointer",
                  isActive
                    ? "text-blue-600 font-semibold"
                    : "text-slate-600 hover:text-slate-900 font-medium"
                )}
              >
                <Icon
                  className={cn(
                    "size-[16px] transition-colors",
                    isActive ? "text-blue-600 stroke-[2]" : "text-slate-400 stroke-[1.75]"
                  )}
                />
                <span>{item.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-blue-600 rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Row 2: Feature Ribbon / Pills Bar (Level 3) ── */}
      {activeItem.subItems && activeItem.subItems.length > 0 && (
        <div className="flex items-center px-6 py-2.5 overflow-x-auto bg-[#f8fafc] border-b border-slate-200/80 gap-2.5 scrollbar-hide">
          {isTerminal && (
            <div className="flex items-center">
              <button
                onClick={() => navigate({ to: '/dashboard' })}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-[12.5px] font-bold transition-all whitespace-nowrap rounded-full bg-slate-900 text-white hover:bg-slate-800"
              >
                <ArrowLeft className="size-3.5" />
                Back to Dashboard
              </button>
              <div className="w-px h-4 bg-slate-200 mx-2.5" />
            </div>
          )}
          {activeItem.subItems.map((sub: any) => {
            const isActive = activeSubItem?.label === sub.label || currentPathWithSearch.includes(sub.to);
            const SubIcon = sub.icon;
            return (
              <button
                key={sub.label}
                onClick={() => handleSubItemClick(sub)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3.5 py-1.5 text-[12.5px] transition-all whitespace-nowrap rounded-full shadow-2xs cursor-pointer",
                  isActive
                    ? "bg-blue-600 text-white font-bold shadow-xs"
                    : "bg-white text-slate-700 border border-slate-200/90 hover:bg-slate-50 hover:text-slate-950 hover:border-slate-300 font-semibold"
                )}
              >
                <SubIcon
                  className={cn(
                    "size-3.5 transition-colors",
                    isActive ? "text-white stroke-[2.2]" : "text-slate-500 stroke-[2]"
                  )}
                />
                <span>{sub.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
