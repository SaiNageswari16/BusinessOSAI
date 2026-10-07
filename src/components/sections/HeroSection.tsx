import { Brain, Building2, Dumbbell, Scissors, Sparkles, ArrowRight } from "lucide-react";

export function HeroSection() {
  return (
    <section id="top" className="relative bg-[#030205] text-white font-sans overflow-x-hidden pt-4 pb-8 md:pt-6 md:pb-10">
      {/* BACKGROUND VIDEO FOR HERO ONLY */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute min-w-full min-h-full object-cover opacity-40 mix-blend-screen"
        >
          <source src="https://cdn.jiro.build/Velara/animate-the-glowing-purple-geometric-shapes-with-s.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-[#030205]/40 via-transparent to-[#030205]/90" />
      </div>

      <div className="relative z-10 px-4 sm:px-6 md:px-10 text-center max-w-5xl mx-auto">
        {/* Social Proof Pill */}
        <div className="inline-flex items-center gap-2.5 bg-white/5 rounded-full px-4 py-1.5 mb-3 border border-white/10 shadow-inner backdrop-blur-md">
          <div className="flex items-center">
            <div className="w-6 h-6 rounded-full border border-[#030205] bg-purple-500/20 flex items-center justify-center shadow-sm">
              <Brain className="w-3 h-3 text-purple-400" />
            </div>
            <div className="w-6 h-6 rounded-full border border-[#030205] bg-blue-500/20 -ml-2 flex items-center justify-center shadow-sm">
              <Building2 className="w-3 h-3 text-blue-400" />
            </div>
            <div className="w-6 h-6 rounded-full border border-[#030205] bg-emerald-500/20 -ml-2 flex items-center justify-center shadow-sm">
              <Dumbbell className="w-3 h-3 text-emerald-400" />
            </div>
            <div className="w-6 h-6 rounded-full border border-[#030205] bg-pink-500/20 -ml-2 flex items-center justify-center shadow-sm">
              <Scissors className="w-3 h-3 text-pink-400" />
            </div>
            <div className="w-6 h-6 rounded-full border border-[#030205] bg-accent/20 -ml-2 flex items-center justify-center shadow-sm">
              <Sparkles className="w-3 h-3 text-accent" />
            </div>
          </div>
          <span className="text-xs text-gray-300 font-medium ml-1">
            Connected AI Business, Fitness & Salon Ecosystem
          </span>
        </div>

        {/* Heading */}
        <h1 className="text-[clamp(32px,5vw,60px)] font-medium leading-[1.08] text-white mb-3 tracking-tight">
          One Platform. <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-violet-200 to-indigo-200 font-bold">
            Smarter Business.
          </span>{" "}
          <br className="hidden sm:inline" />
          <span className="text-white font-light">Endless Possibilities.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-sm md:text-base text-gray-400 leading-relaxed max-w-[620px] mx-auto mb-6 font-light">
          Manage your business, automate daily tasks, and make smarter decisions with AI-powered applications designed to simplify your work.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="#applications"
            className="bg-gradient-to-br from-[#9061f1] to-[#b080ff] text-white px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold hover:opacity-90 hover:-translate-y-0.5 transition-all cursor-pointer shadow-[0_10px_30px_rgba(144,96,240,0.35)] flex items-center gap-2"
          >
            Explore Applications <ArrowRight className="size-3.5" />
          </a>
          <a
            href="#contact"
            className="bg-white/5 border border-white/10 text-white px-6 py-2.5 rounded-full text-xs sm:text-sm font-semibold hover:bg-white/10 transition-all cursor-pointer backdrop-blur-sm"
          >
            Request a Demo
          </a>
        </div>
      </div>
    </section>
  );
}
