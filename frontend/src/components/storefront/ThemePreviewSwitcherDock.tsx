import React, { useState } from "react";
import { useStoreTheme } from "@/contexts/StoreThemeContext";
import {
  Sprout,
  Pill,
  Apple,
  Sparkles,
  Laptop,
  Zap,
  Palette,
  ChevronDown,
  ChevronUp,
  Sliders,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";

const THEME_ICONS: Record<string, React.ElementType> = {
  nursery_botanics: Sprout,
  pharma_medical: Pill,
  modern_fresh: Apple,
  fashion_boutique: Sparkles,
  mega_market: Laptop,
  speed_mart: Zap,
};

export function ThemePreviewSwitcherDock() {
  const { themeId, theme, setThemeId, availableThemes } = useStoreTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300">
      <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 rounded-2xl shadow-2xl p-2 flex flex-col items-center gap-1.5 max-w-[95vw]">
        {/* Top Mini Header */}
        <div className="w-full flex items-center justify-between px-2.5 py-0.5 text-[11px] font-bold text-slate-400 border-b border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-200">
            <Palette className="w-3.5 h-3.5 text-indigo-400" />
            <span className="tracking-wide">BusinessOS Multi-SaaS Theme Engine</span>
            <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[9px] border border-indigo-500/30">
              Live Preview
            </span>
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-[10px]"
          >
            <span>{isCollapsed ? "Show Themes" : "Hide"}</span>
            {isCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Theme Pills Row */}
        {!isCollapsed && (
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full px-1 py-0.5 custom-scrollbar">
            {availableThemes.map((t) => {
              const isActive = themeId === t.id;
              const Icon = THEME_ICONS[t.id] || Palette;

              return (
                <button
                  key={t.id}
                  onClick={() => setThemeId(t.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border",
                    isActive
                      ? "bg-white text-slate-900 border-white shadow-md scale-[1.02]"
                      : "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white"
                  )}
                  style={
                    isActive
                      ? {
                          borderColor: t.accentColor,
                          boxShadow: `0 0 15px ${t.accentColor}40`,
                        }
                      : {}
                  }
                >
                  <div
                    className="size-5 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: t.primaryColor }}
                  >
                    <Icon className="w-3 h-3" />
                  </div>
                  <div className="text-left">
                    <div className="leading-tight text-[11px] font-extrabold">{t.name}</div>
                    <div className="text-[9px] opacity-75 leading-none">{t.sector}</div>
                  </div>
                  {isActive && <Check className="w-3.5 h-3.5 ml-0.5" style={{ color: t.accentColor }} />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
