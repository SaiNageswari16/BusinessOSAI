import { Link, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, Search, Star, PanelLeftClose, PanelLeftOpen, X, ChevronRight
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useRbac } from "@/contexts/rbac-context";
import { cn } from "@/lib/utils";
import { nav } from "@/data/navigation";

// ─── Types ─────────────────────────────────────────────────────────────────────
type SubItem = { to: string; label: string; icon: any; permission?: string };
type NavItem = {
  to: string; label: string; icon: any;
  badge?: string; permission?: string;
  subItems?: SubItem[];
};
type NavGroup = { group: string; permission?: string; items: NavItem[] };

// ─── Accent color per module (very light, pastel-style) ───────────────────────
const GROUP_ACCENT: Record<string, { pill: string; text: string; dot: string }> = {
  "Workspace":                { pill: "bg-blue-50 text-blue-700",      text: "text-blue-700",      dot: "bg-blue-500" },
  "Core ERP":                 { pill: "bg-indigo-50 text-indigo-700",  text: "text-indigo-700",    dot: "bg-indigo-500" },
  "Inventory & Warehouse":    { pill: "bg-emerald-50 text-emerald-700",text: "text-emerald-700",   dot: "bg-emerald-500" },
  "Operations":               { pill: "bg-sky-50 text-sky-700",        text: "text-sky-700",       dot: "bg-sky-500" },
  "Sales & CRM":              { pill: "bg-rose-50 text-rose-700",      text: "text-rose-700",      dot: "bg-rose-500" },
  "Marketplace":              { pill: "bg-amber-50 text-amber-700",    text: "text-amber-700",     dot: "bg-amber-500" },
  "Accounting & Finance":     { pill: "bg-violet-50 text-violet-700",  text: "text-violet-700",    dot: "bg-violet-500" },
  "HRMS":                     { pill: "bg-pink-50 text-pink-700",      text: "text-pink-700",      dot: "bg-pink-500" },
  "IoT":                      { pill: "bg-teal-50 text-teal-700",      text: "text-teal-700",      dot: "bg-teal-500" },
  "Analytics & Intelligence": { pill: "bg-fuchsia-50 text-fuchsia-700",text: "text-fuchsia-700",   dot: "bg-fuchsia-500" },
  "System Configuration":     { pill: "bg-slate-100 text-slate-700",   text: "text-slate-700",     dot: "bg-slate-500" },
};

const FAVORITES_KEY = "bos-nav-favorites";
const loadFavorites = (): string[] => {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]"); }
  catch { return []; }
};
const saveFavorites = (f: string[]) => localStorage.setItem(FAVORITES_KEY, JSON.stringify(f));

// ─── Single nav-item row (used in both accordion and favorites) ────────────────
function NavRow({
  icon: Icon, label, to, isActive, isFav, accent, onToggleFav, indent = false,
}: {
  icon: any; label: string; to: string;
  isActive: boolean; isFav: boolean;
  accent: typeof GROUP_ACCENT[string];
  onToggleFav: (to: string) => void;
  indent?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group relative flex items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        to={to}
        className={cn(
          "flex-1 flex items-center gap-3 rounded-xl transition-all duration-150 text-[13px] font-medium py-2",
          indent ? "pl-10 pr-8" : "pl-3 pr-8",
          isActive
            ? cn(accent.pill, "font-semibold shadow-none")
            : "text-gray-500 hover:text-gray-800 hover:bg-gray-100/80"
        )}
      >
        {!indent && (
          <span className={cn(
            "flex items-center justify-center size-7 rounded-lg transition-colors shrink-0",
            isActive ? cn(accent.pill) : "bg-gray-100 text-gray-500 group-hover:bg-gray-200/80"
          )}>
            <Icon className="size-3.5" />
          </span>
        )}
        <span className="truncate leading-snug">{label}</span>
      </Link>

      {/* Favorite star */}
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleFav(to); }}
        title={isFav ? "Remove from favorites" : "Add to favorites"}
        className={cn(
          "absolute right-2 p-1 rounded-lg transition-all",
          isFav
            ? "opacity-100 text-amber-400 hover:text-amber-500"
            : "opacity-0 group-hover:opacity-100 text-gray-300 hover:text-amber-400"
        )}
      >
        <Star className={cn("size-3", isFav && "fill-current")} />
      </button>
    </div>
  );
}

// ─── Accordion section ─────────────────────────────────────────────────────────
function AccordionSection({
  item, isOpen, onToggle, accent, currentPath, favorites, onToggleFav, searchQ,
}: {
  item: NavItem; isOpen: boolean; onToggle: () => void;
  accent: typeof GROUP_ACCENT[string]; currentPath: string;
  favorites: string[]; onToggleFav: (to: string) => void; searchQ: string;
}) {
  const getBase = (to: string) => to.split("?")[0].replace(/\/$/, "");
  const norm = currentPath.replace(/\/$/, "");

  const hasSubItems = !!item.subItems?.length;

  const visibleSubs = useMemo(() => {
    if (!item.subItems) return [];
    if (!searchQ) return item.subItems;
    return item.subItems.filter(s => s.label.toLowerCase().includes(searchQ.toLowerCase()));
  }, [item.subItems, searchQ]);

  const isGroupActive = item.subItems
    ? item.subItems.some(s => norm === getBase(s.to))
    : norm === getBase(item.to);

  const showContent = searchQ ? visibleSubs.length > 0 : isOpen;

  // Plain item (no children)
  if (!hasSubItems) {
    const isActive = norm === getBase(item.to);
    if (searchQ && !item.label.toLowerCase().includes(searchQ.toLowerCase())) return null;
    return (
      <NavRow
        icon={item.icon} label={item.label} to={item.to}
        isActive={isActive} isFav={favorites.includes(item.to)}
        accent={accent} onToggleFav={onToggleFav}
      />
    );
  }

  if (searchQ && visibleSubs.length === 0) return null;

  return (
    <div>
      {/* Section header (accordion trigger) */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 rounded-xl py-2 pl-3 pr-3 text-[13px] font-medium transition-all duration-150 group",
          isGroupActive && !searchQ
            ? cn(accent.pill, "font-semibold")
            : "text-gray-500 hover:text-gray-800 hover:bg-gray-100/80"
        )}
      >
        <span className={cn(
          "flex items-center justify-center size-7 rounded-lg shrink-0 transition-colors",
          isGroupActive && !searchQ ? accent.pill : "bg-gray-100 text-gray-500 group-hover:bg-gray-200/80"
        )}>
          <item.icon className="size-3.5" />
        </span>
        <span className="flex-1 text-left truncate">{item.label}</span>
        {item.badge && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-gray-200 text-gray-500">
            {item.badge}
          </span>
        )}
        <motion.span
          animate={{ rotate: showContent ? 180 : 0 }}
          transition={{ duration: 0.18, ease: "easeInOut" }}
          className="shrink-0 text-gray-300"
        >
          <ChevronDown className="size-3.5" />
        </motion.span>
      </button>

      {/* Sub-items */}
      <AnimatePresence initial={false}>
        {showContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            {/* Left rule + sub-item rows */}
            <div className="relative ml-6 pl-4 border-l border-gray-200 mt-0.5 mb-1 flex flex-col gap-0.5">
              {visibleSubs.map(sub => {
                const isActive = norm === getBase(sub.to);
                return (
                  <div key={sub.to} className="group relative flex items-center">
                    <Link
                      to={sub.to}
                      className={cn(
                        "flex-1 flex items-center gap-2 truncate py-1.5 pr-7 rounded-lg text-[12.5px] transition-all duration-150 font-medium",
                        isActive
                          ? cn(accent.text, "font-semibold pl-2", accent.pill)
                          : "text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 pl-2"
                      )}
                    >
                      <sub.icon className={cn("size-3.5 shrink-0", isActive ? accent.text : "text-gray-400")} />
                      <span className="truncate">{sub.label}</span>
                    </Link>
                    {/* Sub-item favorite */}
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleFav(sub.to); }}
                      title={favorites.includes(sub.to) ? "Remove from favorites" : "Add to favorites"}
                      className={cn(
                        "absolute right-1.5 p-1 rounded transition-all",
                        favorites.includes(sub.to)
                          ? "opacity-100 text-amber-400"
                          : "opacity-0 group-hover:opacity-100 text-gray-300 hover:text-amber-400"
                      )}
                    >
                      <Star className={cn("size-3", favorites.includes(sub.to) && "fill-current")} />
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Favorites panel ──────────────────────────────────────────────────────────
function FavoritesPanel({
  favorites, allSubs, currentPath, onToggleFav,
}: {
  favorites: string[];
  allSubs: { sub: SubItem; groupName: string; accent: typeof GROUP_ACCENT[string] }[];
  currentPath: string;
  onToggleFav: (to: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const favItems = allSubs.filter(s => favorites.includes(s.sub.to));
  if (!favItems.length) return null;

  const getBase = (to: string) => to.split("?")[0].replace(/\/$/, "");
  const norm = currentPath.replace(/\/$/, "");

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-1 mb-1"
      >
        <span className="text-[10.5px] font-bold uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
          <Star className="size-3 fill-current" /> Favorites
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18 }} className="ml-auto text-gray-300">
          <ChevronDown className="size-3" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-0.5 mb-2">
              {favItems.map(({ sub, accent }) => {
                const isActive = norm === getBase(sub.to);
                return (
                  <div key={sub.to} className="group relative flex items-center">
                    <Link
                      to={sub.to}
                      className={cn(
                        "flex-1 flex items-center gap-2 py-1.5 px-3 rounded-xl text-[12.5px] font-medium transition-all pr-7",
                        isActive
                          ? cn(accent.pill, "font-semibold")
                          : "text-gray-400 hover:text-gray-700 hover:bg-gray-100/80"
                      )}
                    >
                      <sub.icon className={cn("size-3.5 shrink-0", isActive ? accent.text : "text-gray-400")} />
                      <span className="truncate">{sub.label}</span>
                    </Link>
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleFav(sub.to); }}
                      className="absolute right-2 p-1 rounded opacity-100 text-amber-400 hover:text-amber-500"
                    >
                      <Star className="size-3 fill-current" />
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mx-3 mb-2 border-t border-gray-100" />
    </div>
  );
}

// ─── Menu for collapsed mode ────────────────────────────────────────────────
function CollapsedMenu({ item, currentPath, accent }: { item: NavItem, currentPath: string, accent: typeof GROUP_ACCENT[string] }) {
  const [show, setShow] = useState(false);
  const getBase = (to: string) => to.split("?")[0].replace(/\/$/, "");
  const norm = currentPath.replace(/\/$/, "");

  const isActive = item.subItems
    ? item.subItems.some(s => norm === getBase(s.to))
    : norm === getBase(item.to);

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <Link
        to={item.to}
        className={cn(
          "flex items-center justify-center size-9 rounded-xl transition-all",
          isActive
            ? cn(accent.pill)
            : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        )}
      >
        <item.icon className="size-4" />
      </Link>

      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-full ml-2 z-50 py-1.5 rounded-lg bg-white dark:bg-card border border-gray-100 dark:border-border shadow-xl pointer-events-auto min-w-[180px] flex flex-col"
          >
            <div className="px-3 py-1.5 border-b border-gray-50 dark:border-border mb-1">
              <p className="text-[11px] font-bold text-gray-800 dark:text-gray-200">{item.label}</p>
            </div>
            {item.subItems ? (
              item.subItems.map(sub => {
                const subActive = norm === getBase(sub.to);
                return (
                  <Link
                    key={sub.to}
                    to={sub.to}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-1.5 text-[12px] font-medium transition-colors mx-1 rounded-md",
                      subActive ? cn(accent.text, accent.pill) : "text-gray-500 hover:bg-gray-50 dark:hover:bg-muted hover:text-gray-800 dark:hover:text-gray-200"
                    )}
                  >
                    <sub.icon className="size-3.5" />
                    <span>{sub.label}</span>
                  </Link>
                );
              })
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Sidebar ──────────────────────────────────────────────────────────────
export function ModuleSidebar() {
  const { user } = useAuth();
  const { hasPermission } = useRbac();
  const router = useRouterState();
  const currentPath = router.location.pathname;

  const [collapsed, setCollapsed] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);

  const isPlatformAdmin = user?.tenantSlug === "system" && user?.isTenantOwner;

  // Authorized nav
  const authorizedNav: NavGroup[] = useMemo(() =>
    (nav as NavGroup[])
      .filter(g => !g.permission || hasPermission(g.permission))
      .map(g => ({
        ...g,
        items: g.items
          .filter(i => !i.permission || hasPermission(i.permission))
          .map(i => ({
            ...i,
            subItems: i.subItems?.filter(s => {
              if (s.to.includes("global_users")) return isPlatformAdmin;
              return !s.permission || hasPermission(s.permission);
            }),
          }))
          .filter(i => !i.subItems || i.subItems.length > 0),
      }))
      .filter(g => g.items.length > 0),
    [hasPermission, isPlatformAdmin]
  );

  const getBase = (to: string) => to.split("?")[0].replace(/\/$/, "");
  const norm = currentPath.replace(/\/$/, "");

  const activeGroup: NavGroup | undefined = useMemo(() =>
    authorizedNav.find(g =>
      g.items.some(item =>
        norm === getBase(item.to) ||
        item.subItems?.some(s =>
          norm === getBase(s.to) ||
          (norm.startsWith("/erp") && s.to === "/erp?tab=companies")
        )
      )
    ) ||
    authorizedNav.find(g =>
      g.items.some(item =>
        (getBase(item.to).length > 1 && norm.startsWith(getBase(item.to))) ||
        item.subItems?.some(s => getBase(s.to).length > 1 && norm.startsWith(getBase(s.to)))
      )
    ) ||
    authorizedNav.find(g => g.group === "Sales & CRM" && norm.includes("/crm")) ||
    authorizedNav[0],
    [authorizedNav, norm]
  );

  const accent = GROUP_ACCENT[activeGroup?.group ?? ""] ?? GROUP_ACCENT["Workspace"];

  // Auto-open section containing active page
  useEffect(() => {
    if (!activeGroup) return;
    const active = activeGroup.items.find(item =>
      item.subItems?.some(s => norm === getBase(s.to))
    );
    setOpenSection(active?.label ?? null);
  }, [currentPath, activeGroup?.group]);

  useEffect(() => { setSearchQ(""); }, [activeGroup?.group]);

  const toggleSection = useCallback((label: string) => {
    setOpenSection(prev => prev === label ? null : label);
  }, []);

  const toggleFavorite = useCallback((to: string) => {
    setFavorites(prev => {
      const next = prev.includes(to) ? prev.filter(f => f !== to) : [...prev, to];
      saveFavorites(next);
      return next;
    });
  }, []);

  // Flat list of all sub-items for favorites lookup
  const allSubs = useMemo(() =>
    authorizedNav.flatMap(g =>
      g.items.flatMap(item =>
        (item.subItems ?? []).map(sub => ({
          sub,
          groupName: g.group,
          accent: GROUP_ACCENT[g.group] ?? GROUP_ACCENT["Workspace"],
        }))
      )
    ),
    [authorizedNav]
  );

  // Workspace = Dashboard + Copilot, no sidebar needed
  if (!activeGroup || activeGroup.group === "Workspace") return null;

  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 248 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className="shrink-0 h-full bg-white dark:bg-card border-r border-gray-100 dark:border-border flex flex-col overflow-hidden z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.04)]"
      style={{ minWidth: collapsed ? 56 : 248 }}
    >
      {/* ── Sidebar header ── */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100 dark:border-border shrink-0">
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15, delay: 0.05 }}
            className={cn("text-[12px] font-bold tracking-wide truncate pl-1", accent.text)}
          >
            {activeGroup.group.toUpperCase()}
          </motion.span>
        )}
        <button
          onClick={() => setCollapsed(v => !v)}
          className={cn(
            "flex items-center justify-center size-8 rounded-xl transition-all shadow-sm",
            collapsed ? cn(accent.pill, "mx-auto shadow-none") : cn(accent.text, "bg-gray-50 hover:bg-gray-100 border border-gray-100"),
            "dark:bg-muted dark:border-border dark:hover:bg-muted/80"
          )}
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {(() => {
            const MainIcon = activeGroup.items[0]?.icon;
            return MainIcon ? (
              <MainIcon className={cn("size-4", collapsed ? accent.text : "")} />
            ) : (
              <ChevronRight className="size-4" />
            );
          })()}
        </button>
      </div>

      {/* ── Collapsed: icon strip ── */}
      {collapsed && (
        <div className="flex-1 overflow-y-auto py-3 flex flex-col items-center gap-1 scrollbar-none">
          {activeGroup.items.map(item => {
            return (
              <CollapsedMenu
                key={item.label}
                item={item}
                currentPath={currentPath}
                accent={accent}
              />
            );
          })}
        </div>
      )}

      {/* ── Expanded: search + nav ── */}
      {!collapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, delay: 0.06 }}
          className="flex flex-col flex-1 min-h-0"
        >
          {/* Search bar */}
          <div className="px-3 py-2.5 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-300" />
              <input
                type="text"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search"
                className="w-full pl-8 pr-7 py-2 rounded-xl text-[12.5px] bg-gray-50 dark:bg-muted border border-gray-100 dark:border-border outline-none focus:border-gray-300 dark:focus:border-primary/50 transition-colors placeholder:text-gray-300 text-gray-700 dark:text-foreground"
              />
              {searchQ && (
                <button
                  onClick={() => setSearchQ("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          </div>

          {/* Nav scroll area */}
          <div className="flex-1 overflow-y-auto px-2.5 pb-4 scrollbar-none">
            {/* Favorites */}
            <FavoritesPanel
              favorites={favorites}
              allSubs={allSubs}
              currentPath={currentPath}
              onToggleFav={toggleFavorite}
            />

            {/* Section label */}
            {!searchQ && (
              <p className="px-3 mb-2 text-[10.5px] font-bold uppercase tracking-widest text-gray-300 dark:text-muted-foreground">
                Main
              </p>
            )}

            {/* Accordion list */}
            <div className="flex flex-col gap-0.5">
              {activeGroup.items.map(item => (
                <AccordionSection
                  key={item.label}
                  item={item}
                  isOpen={openSection === item.label}
                  onToggle={() => toggleSection(item.label)}
                  accent={accent}
                  currentPath={currentPath}
                  favorites={favorites}
                  onToggleFav={toggleFavorite}
                  searchQ={searchQ}
                />
              ))}
            </div>

            {/* Empty state */}
            {searchQ && activeGroup.items.every(item => {
              const matchLabel = item.label.toLowerCase().includes(searchQ.toLowerCase());
              const matchSub = item.subItems?.some(s => s.label.toLowerCase().includes(searchQ.toLowerCase()));
              return !matchLabel && !matchSub;
            }) && (
              <div className="text-center py-10 text-gray-300 text-[12px]">
                No results for "<span className="text-gray-500 font-medium">{searchQ}</span>"
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.aside>
  );
}
