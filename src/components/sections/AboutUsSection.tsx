import React, { useEffect, useRef, useState } from "react";
import { TrendingUp, Quote, Sparkles, Building2, Dumbbell, Scissors, ArrowRight, ShieldCheck, Layers, RefreshCw, Zap, CheckCircle2 } from "lucide-react";

export function AboutUsSection({ className }: { className?: string }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />

      <style>{`
        @keyframes pulse-purple-border {
          0%, 100% {
            border-color: #9333ea;
            box-shadow: 0 4px 20px rgba(147, 51, 234, 0.15);
          }
          50% {
            border-color: rgba(147, 51, 234, 0.35);
            box-shadow: 0 0 30px rgba(147, 51, 234, 0.28);
          }
        }
        .animate-purple-border {
          animation: pulse-purple-border 3s ease-in-out infinite;
        }
      `}</style>

      <section
        id="about"
        ref={sectionRef}
        className={"py-10 md:py-16 bg-[#f8f9fb] text-zinc-900 font-sans flex items-center relative overflow-hidden border-y border-zinc-200/80 " + (className || "")}
      >
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl relative z-10">
          <div>
            {/* Header */}
            <div
              className={`mb-8 transition-all duration-700 ease-out ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-purple-700 uppercase mb-2.5">
                <Sparkles className="size-3.5 text-purple-600" /> About IOTRONICS
              </div>

              <h2 className="font-sans font-extrabold text-2xl sm:text-3xl md:text-4xl text-zinc-950 leading-[1.12] tracking-[-0.03em] max-w-4xl">
                Automate the manual, accelerate the future. Our vertical AI operating systems deliver measurable growth across business, fitness, and luxury salons.
              </h2>
              <p className="mt-2.5 max-w-2xl text-xs sm:text-sm text-zinc-600 leading-relaxed font-normal">
                We bridge the gap between daily operations and intelligent automation. By unifying enterprise POS & ERP, fitness club management, and luxury salon bookings into one ecosystem, IOTRONICS eliminates human error and accelerates profitability.
              </p>
            </div>

            {/* Grid (12 columns) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 h-auto md:h-[430px]">
              {/* Card 1: Enterprise Operations Visual Card */}
              <div
                className={`md:col-span-3 rounded-3xl overflow-hidden relative group h-[320px] md:h-full shadow-lg transition-all duration-700 ease-out delay-100 ${
                  visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
              >
                <img
                  src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80"
                  alt="IOTRONICS Operations"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 brightness-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/30" />
                <div className="absolute inset-0 p-6 flex flex-col justify-between">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-sm">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-purple-300 bg-purple-500/20 px-2.5 py-0.5 rounded-full border border-purple-400/30 mb-2 font-mono">
                      Enterprise Scale
                    </span>
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">
                      Unified Business Operations
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed font-normal">
                      Autonomous ledger, smart inventory reordering, and multi-branch GST invoicing in real time.
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 2: Connected Ecosystem (Animated Stroke) */}
              <div
                className={`md:col-span-3 bg-white rounded-3xl p-6 sm:p-7 flex flex-col justify-between border-2 border-purple-500 animate-purple-border h-[320px] md:h-full shadow-md transition-all duration-700 ease-out delay-200 ${
                  visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
              >
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-purple-700 mb-4 flex items-center gap-1.5 font-mono">
                    <span className="size-2 rounded-full bg-purple-600 animate-pulse" />
                    Live Ecosystem
                  </div>
                  <div className="flex items-center -space-x-2">
                    {[
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Jude",
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=Sasha",
                    ].map((src: string, i: number) => (
                      <div
                        key={i}
                        className="w-11 h-11 rounded-full border-2 border-white bg-slate-100 overflow-hidden shadow-sm"
                      >
                        <img src={src} alt="Business leader" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-zinc-950 tracking-tight">
                    Multi-Role Collaboration
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium mt-1 leading-relaxed">
                    Store cashiers, gym trainers, and salon stylists work synchronously with zero conflict or data loss.
                  </p>
                </div>
              </div>

              {/* Right Column: Capabilities & Testimonial (6 cols) */}
              <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-2 gap-5 h-full">
                {/* Top Row: Zero-Silo Sync & Predictive Analytics */}
                <div className="flex flex-col gap-5 h-full">
                  <div
                    className={`bg-white border border-zinc-200/90 rounded-3xl p-6 shadow-sm flex flex-col justify-center flex-1 hover:border-purple-300 hover:shadow-md transition-all duration-700 ease-out delay-300 ${
                      visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Zap className="size-4 text-purple-600" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 font-mono">
                        Zero Data Silos
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-zinc-950">
                      Instant Cross-Platform Sync
                    </h4>
                    <p className="text-xs text-zinc-500 font-normal mt-1 leading-relaxed">
                      Instant sync across POS registers, gym turnstile gates, and salon appointment matrices.
                    </p>
                  </div>

                  <div
                    className={`bg-white border border-zinc-200/90 rounded-3xl p-6 shadow-sm flex flex-col justify-end flex-1 hover:border-purple-300 hover:shadow-md transition-all duration-700 ease-out delay-400 ${
                      visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="size-2 rounded-full bg-indigo-600" />
                      <h4 className="text-sm font-bold text-zinc-950">
                        Predictive Analytics
                      </h4>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed font-normal">
                      Anticipates peak gym rush hours, automated stock reorders, and client hair appointments before bottlenecks occur.
                    </p>
                  </div>
                </div>

                {/* Testimonial Card */}
                <div
                  className={`bg-zinc-950 text-white rounded-3xl p-7 shadow-xl flex flex-col justify-between relative h-full transition-all duration-700 ease-out delay-500 border border-zinc-800 ${
                    visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                  }`}
                >
                  <Quote className="w-8 h-8 text-purple-400 mb-4" />
                  <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed italic font-normal">
                    &ldquo;Our operational overhead dropped significantly in the first month. Having our POS, gym memberships, and salon appointments unified under one intelligent AI core is unmatched.&rdquo;
                  </p>
                  <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-purple-300 font-bold mb-0.5 font-mono">
                        Enterprise Wellness Chain
                      </p>
                      <p className="text-xs font-semibold text-white">
                        • VP Operations, Urban Luxe Co.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default AboutUsSection;
