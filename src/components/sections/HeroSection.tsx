import { Brain, Building2, Dumbbell, Scissors, Sparkles, ArrowRight } from "lucide-react";

export function HeroSection() {
  return (
    <section id="top" className="relative bg-[#f8f9fa] text-slate-900 font-sans overflow-x-hidden pt-6 pb-12 md:pt-10 md:pb-16">
      {/* BACKGROUND VIDEO FOR HERO ONLY */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute min-w-full min-h-full object-cover opacity-15 mix-blend-multiply"
        >
          <source src="https://cdn.jiro.build/Velara/animate-the-glowing-purple-geometric-shapes-with-s.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-[#f8f9fa]/80 via-transparent to-[#f8f9fa]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/40 via-transparent to-transparent pointer-events-none" />
      </div>

      <div className="relative z-10 px-4 sm:px-6 md:px-10 text-center max-w-5xl mx-auto">
        {/* Social Proof Pill */}
        <div className="inline-flex items-center gap-2.5 bg-white/90 rounded-full px-4 py-1.5 mb-4 border border-slate-200/90 shadow-sm backdrop-blur-md">
          <div className="flex items-center">
            <div className="w-6 h-6 rounded-full border border-white bg-purple-500/15 flex items-center justify-center shadow-xs">
              <Brain className="w-3 h-3 text-purple-600" />
            </div>
            <div className="w-6 h-6 rounded-full border border-white bg-blue-500/15 -ml-2 flex items-center justify-center shadow-xs">
              <Building2 className="w-3 h-3 text-blue-600" />
            </div>
            <div className="w-6 h-6 rounded-full border border-white bg-emerald-500/15 -ml-2 flex items-center justify-center shadow-xs">
              <Dumbbell className="w-3 h-3 text-emerald-600" />
            </div>
            <div className="w-6 h-6 rounded-full border border-white bg-pink-500/15 -ml-2 flex items-center justify-center shadow-xs">
              <Scissors className="w-3 h-3 text-pink-600" />
            </div>
            <div className="w-6 h-6 rounded-full border border-white bg-purple-600/15 -ml-2 flex items-center justify-center shadow-xs">
              <Sparkles className="w-3 h-3 text-purple-600" />
            </div>
          </div>
          <span className="text-xs text-slate-700 font-semibold ml-1">
            Connected AI Business, Fitness &amp; Salon Ecosystem
          </span>
        </div>

        {/* Heading */}
        <h1 className="text-[clamp(32px,5vw,60px)] font-bold leading-[1.08] text-slate-950 mb-3 tracking-tight">
          One Platform. <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-700 via-indigo-600 to-violet-700 font-extrabold">
            Smarter Business.
          </span>{" "}
          <br className="hidden sm:inline" />
          <span className="text-slate-800 font-semibold">Endless Possibilities.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-sm md:text-base text-slate-600 leading-relaxed max-w-[620px] mx-auto mb-6 font-normal">
          Manage your business, automate daily tasks, and make smarter decisions with AI-powered applications designed to simplify your work.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="#applications"
            className="bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 text-white px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold hover:opacity-95 hover:-translate-y-0.5 transition-all cursor-pointer shadow-[0_10px_25px_rgba(124,58,237,0.25)] flex items-center gap-2"
          >
            Explore Applications <ArrowRight className="size-3.5" />
          </a>
          <a
            href="#contact"
            className="bg-white border border-slate-200/90 text-slate-800 px-6 py-2.5 rounded-full text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-all cursor-pointer shadow-sm hover:border-purple-300"
          >
            Request a Demo
          </a>
        </div>
      </div>
    </section>
  );
}
