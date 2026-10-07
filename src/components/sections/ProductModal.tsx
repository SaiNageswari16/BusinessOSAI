import { useState } from "react";
import { X, CheckCircle2, ArrowRight, ExternalLink, Sparkles, Layers, Cpu, ShieldCheck } from "lucide-react";
import { type ProductItem } from "@/data/products";
import { Icon } from "@/components/site/icon";
import { cn } from "@/lib/utils";

export function ProductModal({
  product,
  onClose,
}: {
  product: ProductItem;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"features" | "benefits" | "tech">("features");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-3xl border border-zinc-200 bg-white text-zinc-900 shadow-2xl overflow-hidden my-8 font-sans">
        {/* Modal Top Header with screenshot header */}
        <div className="relative h-48 sm:h-56 w-full overflow-hidden bg-zinc-100">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-black/60 text-white hover:bg-black transition-all shadow-md cursor-pointer"
          >
            <X className="size-4.5" />
          </button>

          {/* Title on bottom of banner */}
          <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-gradient-brand text-white shadow-lg">
                <Icon name={product.icon} className="size-6" />
              </span>
              <div>
                <span className="text-[11px] font-bold text-purple-300 tracking-wider uppercase">
                  {product.category}
                </span>
                <h2 className="font-sans text-2xl sm:text-3xl font-extrabold text-white">
                  {product.name}
                </h2>
              </div>
            </div>

            {product.badge && (
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white border border-white/30 backdrop-blur-sm shadow-sm">
                {product.badge}
              </span>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-5 bg-white">
          {/* Tagline & Description */}
          <div>
            <p className="text-sm sm:text-base font-bold text-zinc-950">
              {product.tagline}
            </p>
            <p className="mt-1.5 text-xs sm:text-sm text-zinc-600 leading-relaxed font-normal">
              {product.description}
            </p>
          </div>

          {/* Tag Chips */}
          <div className="flex flex-wrap gap-1.5">
            {product.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 border border-zinc-200"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Quick Metrics Bar */}
          {product.stats && (
            <div className="grid grid-cols-3 gap-3 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200 text-center">
              {product.stats.map((st) => (
                <div key={st.label}>
                  <p className="text-lg sm:text-xl font-black text-purple-600">{st.value}</p>
                  <p className="text-[11px] text-zinc-500 font-medium mt-0.5">{st.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tabs for Features, Benefits, Tech Stack */}
          <div>
            <div className="flex border-b border-zinc-200 gap-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab("features")}
                className={cn(
                  "pb-2.5 transition-colors border-b-2 cursor-pointer",
                  activeTab === "features"
                    ? "border-purple-600 text-purple-600"
                    : "border-transparent text-zinc-500 hover:text-zinc-900"
                )}
              >
                Key Features
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("benefits")}
                className={cn(
                  "pb-2.5 transition-colors border-b-2 cursor-pointer",
                  activeTab === "benefits"
                    ? "border-purple-600 text-purple-600"
                    : "border-transparent text-zinc-500 hover:text-zinc-900"
                )}
              >
                Business Benefits
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tech")}
                className={cn(
                  "pb-2.5 transition-colors border-b-2 cursor-pointer",
                  activeTab === "tech"
                    ? "border-purple-600 text-purple-600"
                    : "border-transparent text-zinc-500 hover:text-zinc-900"
                )}
              >
                Technology Stack
              </button>
            </div>

            {/* Tab content */}
            <div className="mt-4">
              {activeTab === "features" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {product.features.map((f) => (
                    <div key={f.title} className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3.5 shadow-sm">
                      <p className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-purple-600" /> {f.title}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-600 leading-relaxed font-normal">
                        {f.desc}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "benefits" && (
                <ul className="space-y-2">
                  {product.benefits.map((b) => (
                    <li key={b} className="flex items-center gap-2.5 text-xs text-zinc-800">
                      <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                      <span className="font-medium">{b}</span>
                    </li>
                  ))}
                </ul>
              )}

              {activeTab === "tech" && (
                <div className="flex flex-wrap gap-2">
                  {product.techStack.map((t) => (
                    <span
                      key={t}
                      className="rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-xs font-mono font-medium text-zinc-800"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-zinc-200 pt-4">
            <span className="text-xs text-zinc-500">
              Interested in deploying {product.name}?
            </span>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {product.externalUrl && (
                <a
                  href={product.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 sm:flex-none rounded-full border border-purple-500/40 bg-purple-50 px-4 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100 transition-colors flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="size-3.5" /> Visit Live Portal
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Close
              </button>
              <a
                href="#contact"
                onClick={onClose}
                className="flex-1 sm:flex-none rounded-full bg-gradient-brand px-5 py-2 text-xs font-bold text-white shadow-md transition-all hover:brightness-110 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Request Demo <ArrowRight className="size-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
