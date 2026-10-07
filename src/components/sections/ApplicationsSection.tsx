import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Layers, ChevronRight, ExternalLink } from "lucide-react";
import { products } from "@/data/products";
import { Icon } from "@/components/site/icon";

export function ApplicationsSection() {
  return (
    <section id="applications" className="relative overflow-hidden py-8 md:py-12 bg-[#f8f9fb] text-zinc-900 font-sans border-y border-zinc-200/80">
      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6">
        {/* Section Heading */}
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-[11px] font-semibold tracking-wider text-purple-700 uppercase">
            <Sparkles className="size-3 text-purple-600" /> Our Applications
          </span>
          <h2 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-extrabold text-zinc-950 tracking-tight leading-[1.15]">
            Intelligent applications built to{" "}
            <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent">
              power every workflow.
            </span>
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-zinc-600 leading-relaxed max-w-2xl">
            Discover AI-powered applications built to improve productivity, simplify workflows, and accelerate business growth. Click on any application to view the full product deep-dive.
          </p>
        </div>

        {/* Grid of 3 Product Cards Linking to Dedicated Full Pages */}
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
          {products.map((prod) => (
            <div
              key={prod.id}
              className="group flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-purple-400/60 hover:shadow-xl"
            >
              {/* Product Screenshot Banner */}
              <Link
                to="/products/$productId"
                params={{ productId: prod.id }}
                className="block relative h-44 w-full overflow-hidden bg-zinc-100 cursor-pointer"
              >
                <img
                  src={prod.image}
                  alt={prod.name}
                  loading="lazy"
                  className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

                {prod.badge && (
                  <span className="absolute top-2.5 right-2.5 rounded-full bg-purple-600/90 px-2.5 py-0.5 text-[9px] font-bold text-white shadow-sm backdrop-blur-sm">
                    {prod.badge}
                  </span>
                )}

                <div className="absolute bottom-2.5 left-3 flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-lg bg-white text-purple-600 shadow-md">
                    <Icon name={prod.icon} className="size-4" />
                  </span>
                  <span className="text-xs font-bold text-white drop-shadow-md">
                    {prod.name}
                  </span>
                </div>
              </Link>

              {/* Card Body */}
              <div className="flex flex-1 flex-col justify-between p-5 space-y-3.5 bg-white">
                <div>
                  <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">
                    {prod.category}
                  </p>
                  <Link
                    to="/products/$productId"
                    params={{ productId: prod.id }}
                    className="block text-base font-bold text-zinc-950 mt-0.5 hover:text-purple-600 transition-colors"
                  >
                    {prod.name}
                  </Link>
                  <p className="mt-1 text-xs text-zinc-600 line-clamp-2 leading-relaxed font-normal">
                    {prod.description}
                  </p>
                </div>

                {/* Tag Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {prod.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700 border border-zinc-200/80"
                    >
                      {tag}
                    </span>
                  ))}
                  {prod.tags.length > 3 && (
                    <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500 border border-zinc-200/80">
                      +{prod.tags.length - 3}
                    </span>
                  )}
                </div>

                {/* Direct Link to Full Dedicated Page */}
                <div className="pt-2.5 border-t border-zinc-100 flex items-center gap-2">
                  <Link
                    to="/products/$productId"
                    params={{ productId: prod.id }}
                    className="flex-1 flex items-center justify-between rounded-xl bg-zinc-50 hover:bg-purple-600 hover:text-white px-3.5 py-2.5 text-xs font-bold text-zinc-900 border border-zinc-200/80 transition-all cursor-pointer shadow-sm group-hover:border-purple-300"
                  >
                    <span>Deep Dive Product Page</span>
                    <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                  </Link>

                  {prod.externalUrl && (
                    <a
                      href={prod.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Open Live App Portal"
                      className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
