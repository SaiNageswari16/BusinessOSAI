"use client";

import React from "react";

const BRANDS = [
  {
    name: "Nizampet Municipal Corporation",
    url: "/logos/nizampet.png",
    heightClass: "h-[46px] md:h-[52px]",
  },
  {
    name: "CDMA - Government of Telangana",
    url: "/logos/cdma.png",
    heightClass: "h-[48px] md:h-[54px]",
  },
  {
    name: "Department of Veterinary & Animal Husbandry",
    url: "/logos/veterinary.png",
    heightClass: "h-[44px] md:h-[50px]",
  },
  {
    name: "Peerzadiguda Municipal Corporation",
    url: "/logos/peerzadiguda.png",
    heightClass: "h-[46px] md:h-[52px]",
  },
  {
    name: "ASCI - Administrative Staff College of India",
    url: "/logos/asci.png",
    heightClass: "h-[42px] md:h-[48px]",
  },
  {
    name: "Feedback Infra - Making Infrastructure Happen",
    url: "/logos/feedback-infra.png",
    heightClass: "h-[36px] md:h-[42px]",
  },
];

export function TrustedBrandBlack({ className }: { className?: string }) {
  const marqueeItems = [...BRANDS, ...BRANDS, ...BRANDS];

  return (
    <>
      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(calc(-50% - 35px)); }
        }
        @keyframes marquee-scroll-mobile {
          from { transform: translateX(0); }
          to { transform: translateX(calc(-50% - 20px)); }
        }
        .marquee-content {
          animation: marquee-scroll 34s linear infinite;
          will-change: transform;
        }
        .marquee-container:hover .marquee-content {
          animation-play-state: paused;
        }
        @media (max-width: 768px) {
          .marquee-content {
            gap: 40px;
            animation: marquee-scroll-mobile 22s linear infinite;
          }
        }
      `}</style>

      <section
        className={
          "w-full bg-[#f1f3f6] py-2.5 md:py-3.5 overflow-hidden select-none relative border-y border-slate-200/80 " +
          (className || "")
        }
      >
        <div className="max-w-[1240px] mx-auto relative z-10 px-4 mb-1.5 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 border border-slate-200/90 shadow-2xs">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[10.5px] sm:text-[11.5px] font-bold uppercase tracking-[0.14em] text-slate-600">
              Trusted by Municipal Corporations, Government Bodies &amp; Enterprise Leaders
            </p>
          </div>
        </div>
        <div className="max-w-[1240px] mx-auto relative z-10 px-4">
          <div className="marquee-container relative flex overflow-hidden group [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
            <div className="marquee-content flex shrink-0 gap-[50px] md:gap-[70px] min-w-full items-center">
              {[...marqueeItems, ...marqueeItems].map((brand, idx) => (
                <div
                  key={`${brand.name}-${idx}`}
                  className="flex items-center justify-center shrink-0 transition-transform duration-300 hover:scale-108"
                  title={brand.name}
                >
                  <img
                    src={brand.url}
                    alt={brand.name}
                    className={`${brand.heightClass} w-auto max-w-[160px] object-contain shrink-0 drop-shadow-xs transition-all duration-300 cursor-pointer`}
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default TrustedBrandBlack;
