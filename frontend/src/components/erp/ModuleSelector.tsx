import React from "react";
import {
  SYSTEM_MODULES,
  MODULE_PRESETS,
  ALL_MODULE_IDS,
  type SystemModule,
} from "@/data/modules-config";
import {
  Check,
  Sparkles,
  Layers,
  CheckSquare,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ModuleSelectorProps {
  selectedModules: string[];
  onChange: (modules: string[]) => void;
  disabled?: boolean;
  title?: string;
  subtitle?: string;
}

export function ModuleSelector({
  selectedModules,
  onChange,
  disabled = false,
  title = "Allowed Portal Modules (UI Visibility)",
  subtitle = "Choose which modules are displayed in the top navigation ribbon and workspace menus for users with this role.",
}: ModuleSelectorProps) {
  const currentSet = new Set(selectedModules);

  const handleToggle = (moduleId: string) => {
    if (disabled) return;
    if (moduleId === "dashboard") return; // Dashboard is always retained

    const next = new Set(currentSet);
    if (next.has(moduleId)) {
      next.delete(moduleId);
    } else {
      next.add(moduleId);
    }

    next.add("dashboard");
    onChange(Array.from(next));
  };

  const handleApplyPreset = (presetModules: string[]) => {
    if (disabled) return;
    onChange(Array.from(new Set(["dashboard", ...presetModules])));
  };

  const handleSelectAll = () => {
    if (disabled) return;
    onChange([...ALL_MODULE_IDS]);
  };

  const handleClearNonDashboard = () => {
    if (disabled) return;
    onChange(["dashboard"]);
  };

  const categories = [
    "Core Operations",
    "Commerce & POS",
    "Finance & People",
    "Administration & Master",
  ] as const;

  const activePreset = MODULE_PRESETS.find((p) => {
    if (p.modules.length !== selectedModules.length) return false;
    return p.modules.every((m) => selectedModules.includes(m));
  });

  return (
    <div className="space-y-4 rounded-xl border border-slate-200/90 bg-slate-50/60 p-4.5 dark:border-slate-800 dark:bg-slate-900/50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="size-4.5 text-purple-600 dark:text-purple-400" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h4>
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
              {selectedModules.length} of {SYSTEM_MODULES.length} Modules Active
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>

        {!disabled && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleSelectAll}
              className="flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-800 hover:underline dark:text-purple-400 cursor-pointer"
            >
              <CheckSquare className="size-3.5" />
              Select All
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              type="button"
              onClick={handleClearNonDashboard}
              className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:underline dark:text-slate-400 cursor-pointer"
            >
              <Square className="size-3.5" />
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Quick Presets */}
      {!disabled && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Sparkles className="size-3 text-amber-500" /> Quick Role Presets:
          </label>
          <div className="flex flex-wrap gap-1.5">
            {MODULE_PRESETS.map((preset) => {
              const isSelected = activePreset?.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset.modules)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                    isSelected
                      ? "border-purple-600 bg-purple-600 text-white shadow-xs"
                      : "border-slate-200 bg-white text-slate-700 hover:border-purple-300 hover:bg-purple-50/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  )}
                >
                  <span>{preset.name}</span>
                  {isSelected && <Check className="size-3" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Module Grid by Category */}
      <div className="space-y-4 pt-1">
        {categories.map((cat) => {
          const categoryModules = SYSTEM_MODULES.filter((m) => m.category === cat);
          if (categoryModules.length === 0) return null;

          return (
            <div key={cat} className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {cat}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {categoryModules.map((module) => {
                  const isChecked = currentSet.has(module.id);
                  const isPermanent = module.id === "dashboard";
                  const Icon = module.icon;

                  return (
                    <div
                      key={module.id}
                      onClick={() => !isPermanent && handleToggle(module.id)}
                      className={cn(
                        "flex items-start justify-between gap-3 p-3.5 rounded-xl border transition-all text-left select-none",
                        disabled
                          ? "opacity-60 cursor-not-allowed"
                          : isPermanent
                          ? "cursor-default"
                          : "cursor-pointer",
                        isChecked
                          ? "border-purple-400 bg-purple-50/50 shadow-2xs dark:border-purple-700 dark:bg-purple-950/25"
                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/70"
                      )}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div
                          className={cn(
                            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                            isChecked
                              ? "bg-purple-600 text-white"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                          )}
                        >
                          <Icon className="size-4.5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "text-sm font-bold truncate",
                                isChecked
                                  ? "text-purple-950 dark:text-purple-200"
                                  : "text-slate-800 dark:text-slate-200"
                              )}
                            >
                              {module.name}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                            {module.description}
                          </p>
                          {isPermanent && (
                            <span className="mt-1.5 inline-block text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                              Always Available
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Checkbox */}
                      <div className="pt-0.5 shrink-0">
                        <div
                          className={cn(
                            "flex size-5 items-center justify-center rounded border transition-colors",
                            isChecked
                              ? "border-purple-600 bg-purple-600 text-white"
                              : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-700"
                          )}
                        >
                          {isChecked && <Check className="size-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
