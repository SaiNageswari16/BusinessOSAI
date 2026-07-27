import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { nav, NavGroup, NavItem } from "@/data/navigation";
import { cn } from "@/lib/utils";
import { Menu, X, ArrowLeft } from "lucide-react";
import { useRbac } from "@/contexts/rbac-context";

const themeMap: Record<string, { text: string; indicator: string; bgL2: string; borderL2: string; bgL3: string; shadowL3: string; }> = {
  slate: { text: "text-slate-600", indicator: "bg-slate-600", bgL2: "bg-slate-50/50", borderL2: "border-slate-100", bgL3: "bg-gradient-to-br from-slate-400 to-slate-600", shadowL3: "shadow-slate-500/30" },
  blue: { text: "text-blue-600", indicator: "bg-blue-600", bgL2: "bg-blue-50/50", borderL2: "border-blue-100", bgL3: "bg-gradient-to-br from-blue-400 to-blue-600", shadowL3: "shadow-blue-500/30" },
  emerald: { text: "text-emerald-600", indicator: "bg-emerald-600", bgL2: "bg-emerald-50/50", borderL2: "border-emerald-100", bgL3: "bg-gradient-to-br from-emerald-400 to-emerald-600", shadowL3: "shadow-emerald-500/30" },
  teal: { text: "text-teal-600", indicator: "bg-teal-600", bgL2: "bg-teal-50/50", borderL2: "border-teal-100", bgL3: "bg-gradient-to-br from-teal-400 to-teal-600", shadowL3: "shadow-teal-500/30" },
  rose: { text: "text-rose-600", indicator: "bg-rose-600", bgL2: "bg-rose-50/50", borderL2: "border-rose-100", bgL3: "bg-gradient-to-br from-rose-400 to-rose-600", shadowL3: "shadow-rose-500/30" },
  orange: { text: "text-orange-600", indicator: "bg-orange-600", bgL2: "bg-orange-50/50", borderL2: "border-orange-100", bgL3: "bg-gradient-to-br from-orange-400 to-orange-600", shadowL3: "shadow-orange-500/30" },
  violet: { text: "text-violet-600", indicator: "bg-violet-600", bgL2: "bg-violet-50/50", borderL2: "border-violet-100", bgL3: "bg-gradient-to-br from-violet-400 to-violet-600", shadowL3: "shadow-violet-500/30" },
  sky: { text: "text-sky-600", indicator: "bg-sky-600", bgL2: "bg-sky-50/50", borderL2: "border-sky-100", bgL3: "bg-gradient-to-br from-sky-400 to-sky-600", shadowL3: "shadow-sky-500/30" },
  indigo: { text: "text-indigo-600", indicator: "bg-indigo-600", bgL2: "bg-indigo-50/50", borderL2: "border-indigo-100", bgL3: "bg-gradient-to-br from-indigo-400 to-indigo-600", shadowL3: "shadow-indigo-500/30" },
  cyan: { text: "text-cyan-600", indicator: "bg-cyan-600", bgL2: "bg-cyan-50/50", borderL2: "border-cyan-100", bgL3: "bg-gradient-to-br from-cyan-400 to-cyan-600", shadowL3: "shadow-cyan-500/30" },
  zinc: { text: "text-zinc-600", indicator: "bg-zinc-600", bgL2: "bg-zinc-50/50", borderL2: "border-zinc-100", bgL3: "bg-gradient-to-br from-zinc-500 to-zinc-800", shadowL3: "shadow-zinc-500/30" },
  fuchsia: { text: "text-fuchsia-600", indicator: "bg-fuchsia-600", bgL2: "bg-fuchsia-50/50", borderL2: "border-fuchsia-100", bgL3: "bg-gradient-to-br from-fuchsia-400 to-fuchsia-600", shadowL3: "shadow-fuchsia-500/30" }
};

export function RibbonNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = useRbac();

  // Filter nav groups to only those the user is permitted to see
  const visibleNav = useMemo(() => {
    return nav.filter((group) => {
      // If no permission required, always show (e.g. Workspace/Dashboard)
      if (!group.permission) return true;
      return hasPermission(group.permission);
    });
  }, [hasPermission]);

  // Find active items based on URL + Search string
  const currentPathWithSearch = location.href;
  const currentPath = location.pathname;

  let activeG = visibleNav[0] ?? nav[0];
  let activeI = (visibleNav[0] ?? nav[0]).items[0];
  let activeS = nav[0].items[0]?.subItems?.[0];

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

  // Fallback to pathname matching if no precise search param match
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isRibbonCollapsed, setIsRibbonCollapsed] = useState(false);

  const isTerminal = activeGroup?.group === "POS" && activeItem?.label === "Terminal";

  // Sync state with URL if URL changes externally (e.g. back button)
  useEffect(() => {
    setActiveGroup(activeG);
    setActiveItem(activeI);
    setActiveSubItem(activeS);
  }, [location.pathname, location.href]);

  const handleGroupClick = (group: NavGroup) => {
    if (activeGroup.group === group.group) {
      setIsRibbonCollapsed(!isRibbonCollapsed);
      return;
    }
    
    setIsRibbonCollapsed(false);
    setActiveGroup(group);
    const firstItem = group.items[0];
    setActiveItem(firstItem);
    
    if (firstItem.subItems && firstItem.subItems.length > 0) {
      setActiveSubItem(firstItem.subItems[0]);
      navigate({ to: firstItem.subItems[0].to });
    } else {
      setActiveSubItem(undefined);
      navigate({ to: firstItem.to });
    }
    setMobileMenuOpen(false);
  };

  const handleItemClick = (item: NavItem) => {
    setActiveItem(item);
    if (item.subItems && item.subItems.length > 0) {
      setActiveSubItem(item.subItems[0]);
      navigate({ to: item.subItems[0].to });
    } else {
      setActiveSubItem(undefined);
      navigate({ to: item.to });
    }
  };

  const handleSubItemClick = (sub: any) => {
    setActiveSubItem(sub);
    navigate({ to: sub.to });
  };

  return (
    <div className="flex flex-col w-full shrink-0 bg-white z-40 relative shadow-sm">
      {/* Mobile Header for drawer toggle */}
      {!isTerminal && (
        <div className="md:hidden flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2 font-semibold">
            <activeGroup.icon className="size-5 text-primary" />
            {activeGroup.group}
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 bg-muted rounded-lg">
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      )}

      {/* Level 1: Main Modules */}
      {!isTerminal && (
        <div className={cn(
          "md:flex md:flex-row md:items-center md:px-0 md:overflow-x-auto border-b border-border bg-white transition-all pb-1 md:pb-0",
          mobileMenuOpen ? "flex flex-col absolute top-full left-0 right-0 bg-background shadow-xl border-b z-50 p-4 gap-2" : "hidden md:flex"
        )}>
          {visibleNav.map((group) => {
            const isActive = activeGroup.group === group.group;
            const themeObj = themeMap[group.theme || "blue"] || themeMap.blue;
            return (
              <button
                key={group.group}
                onClick={() => handleGroupClick(group)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1.5 min-w-[100px] h-[72px] px-3 text-[13px] font-bold text-black dark:text-white transition-all whitespace-nowrap",
                  !isActive && "hover:bg-black/5 dark:hover:bg-white/5 opacity-90 hover:opacity-100"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center size-[28px] rounded-[8px] shadow-sm transition-all",
                  themeObj.bgL3
                )}>
                  <group.icon className="size-[16px] text-white" strokeWidth={isActive ? 2 : 1.5} />
                </div>
                <span>{group.group}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Collapsible Section for Level 2 and Level 3 */}
      <AnimatePresence initial={false}>
        {!isRibbonCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden flex flex-col"
          >
            {/* Level 2: Module Ribbon (Browser Tabs) */}
            {!isTerminal && (
              <div className="flex items-end px-4 overflow-x-auto bg-white pt-3 pb-1.5 gap-1.5 border-b border-border/60">
                {activeGroup.items.map((item) => {
                  const isActive = activeItem.label === item.label;
                  const themeObj = themeMap[activeGroup.theme || "blue"] || themeMap.blue;
                  return (
                    <button
                      key={item.label}
                      onClick={() => handleItemClick(item)}
                      className={cn(
                        "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap rounded-t-lg border border-transparent",
                        isActive 
                          ? `${themeObj.bgL2} ${themeObj.text} ${themeObj.borderL2} border-b-transparent z-10` 
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                      )}
                      style={isActive ? { marginBottom: "-1.5px" } : {}}
                    >
                      <item.icon 
                        strokeWidth={2.5}
                        className={cn("size-[22px]", themeObj.text, !isActive && "opacity-80")} 
                      />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Level 3: Feature Ribbon (Pills) */}
            {activeItem.subItems && activeItem.subItems.length > 0 && (
              <div className="flex items-center px-5 pt-2.5 pb-3 overflow-x-auto bg-white gap-2.5 border-b border-border/40">
                {isTerminal && (
                  <div className="flex items-center">
                    <button 
                      onClick={() => navigate({to: '/dashboard'})} 
                      className="flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-semibold transition-all whitespace-nowrap rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200"
                    >
                      <ArrowLeft className="size-4" />
                      Back to Dashboard
                    </button>
                    <div className="w-px h-5 bg-border mx-3" />
                  </div>
                )}
                {activeItem.subItems.map((sub: any) => {
                  const isActive = activeSubItem?.label === sub.label;
                  const themeObj = themeMap[activeGroup.theme || "blue"] || themeMap.blue;
                  return (
                    <button
                      key={sub.label}
                      onClick={() => handleSubItemClick(sub)}
                      className={cn(
                        "relative flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-medium transition-all whitespace-nowrap rounded-full border",
                        isActive 
                          ? `${themeObj.bgL3} text-white border-transparent shadow-md ${themeObj.shadowL3}` 
                          : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground hover:border-border/50"
                      )}
                    >
                      <sub.icon className={cn("size-3.5", isActive ? "text-white" : "opacity-60")} />
                      {sub.label}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
