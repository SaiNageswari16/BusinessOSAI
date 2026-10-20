"use client";

import React from "react";

const BRANDS = [
  {
    name: "GHMC - Greater Hyderabad Municipal Corporation",
    displayName: "GHMC (Greater Hyderabad)",
    subName: "Municipal Corporation",
    url: "/logos/ghmc.png",
    heightClass: "h-[40px] md:h-[46px]",
  },
  {
    name: "Nizampet Municipal Corporation",
    displayName: "Nizampet Corporation",
    subName: "Municipal Corporation",
    url: "/logos/nizampet.png",
    heightClass: "h-[42px] md:h-[48px]",
  },
  {
    name: "CDMA - Government of Telangana",
    displayName: "CDMA Telangana",
    subName: "Municipal Administration",
    url: "/logos/cdma.png",
    heightClass: "h-[44px] md:h-[50px]",
  },
  {
    name: "Department of Veterinary & Animal Husbandry",
    displayName: "Veterinary & Animal Husbandry",
    subName: "Government Department",
    url: "/logos/veterinary.png",
    heightClass: "h-[40px] md:h-[46px]",
  },
  {
    name: "Peerzadiguda Municipal Corporation",
    displayName: "Peerzadiguda (PMC)",
    subName: "Municipal Corporation",
    url: "/logos/peerzadiguda.png",
    heightClass: "h-[42px] md:h-[48px]",
  },
  {
    name: "ASCI - Administrative Staff College of India",
    displayName: "ASCI Hyderabad",
    subName: "Admin Staff College of India",
    url: "/logos/asci.png",
    heightClass: "h-[38px] md:h-[44px]",
  },
  {
    name: "Feedback Infra - Making Infrastructure Happen",
    displayName: "Feedback Infra",
    subName: "Infrastructure Advisory",
    url: "/logos/feedback-infra.png",
    heightClass: "h-[32px] md:h-[36px]",
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
          animation: marquee-scroll 36s linear infinite;
          will-change: transform;
        }
        .marquee-container:hover .marquee-content {
          animation-play-state: paused;
        }
        @media (max-width: 768px) {
          .marquee-content {
            gap: 40px;
            animation: marquee-scroll-mobile 24s linear infinite;
          }
        }
      `}</style>

      <section
        className={
          "w-full bg-[#f1f3f6] pt-2 md:pt-2.5 pb-2.5 md:pb-3 overflow-hidden select-none relative z-20 border-y border-slate-200/80 -mt-1 md:-mt-2 " +
          (className || "")
        }
      >
        <div className="max-w-[1240px] mx-auto relative z-10 px-3 sm:px-4 mb-1.5 text-center">
          <div className="inline-flex max-w-full items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-0.5 rounded-full bg-white/70 border border-slate-200/90 shadow-2xs">
            <span className="size-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider sm:tracking-[0.14em] text-slate-600 leading-tight">
              Trusted by Municipal Corporations, Government Bodies &amp; Enterprise Leaders
            </p>
          </div>
        </div>
        <div className="max-w-[1240px] mx-auto relative z-10 px-4">
          <div className="marquee-container relative flex overflow-hidden group [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
            <div className="marquee-content flex shrink-0 gap-[55px] md:gap-[75px] min-w-full items-center py-1">
              {[...marqueeItems, ...marqueeItems].map((brand, idx) => (
                <div
                  key={`${brand.name}-${idx}`}
                  className="flex flex-col items-center justify-center shrink-0 transition-all duration-300 hover:scale-105 gap-1.5 px-2 text-center group cursor-pointer"
                  title={brand.name}
                >
                  <div className="h-[46px] md:h-[52px] flex items-center justify-center">
                    <img
                      src={brand.url}
                      alt={brand.name}
                      className={`${brand.heightClass} w-auto max-w-[150px] object-contain shrink-0 drop-shadow-xs transition-transform duration-300 group-hover:scale-105`}
                      loading="lazy"
                    />
                  </div>
                  <div className="flex flex-col items-center leading-tight">
                    <span className="text-[11.5px] sm:text-[12px] font-bold text-slate-800 tracking-tight whitespace-nowrap group-hover:text-purple-700 transition-colors">
                      {brand.displayName}
                    </span>
                    <span className="text-[9.5px] sm:text-[10px] font-medium text-slate-500 uppercase tracking-wider font-mono whitespace-nowrap mt-0.5">
                      {brand.subName}
                    </span>
                  </div>
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
