"use client";

import React from "react";

const SCREENSHOT_BRANDS = [
  {
    name: "Greater Hyderabad Municipal Corporation (GHMC)",
    displayName: "GHMC (Greater Hyderabad)",
    subName: "MUNICIPAL CORPORATION",
    url: "/logos/ghmc.png",
    heightClass: "h-[40px] md:h-[46px]",
  },
  {
    name: "Administrative Staff College of India (ASCI)",
    displayName: "ASCI Hyderabad",
    subName: "ADMIN STAFF COLLEGE OF INDIA",
    url: "/logos/asci.png",
    heightClass: "h-[38px] md:h-[44px]",
  },
  {
    name: "CDMA - Commissioner & Director of Municipal Administration",
    displayName: "CDMA Telangana",
    subName: "MUNICIPAL ADMINISTRATION",
    url: "/logos/cdma.png",
    heightClass: "h-[44px] md:h-[50px]",
  },
  {
    name: "Veterinary & Animal Husbandry Department (VAHD), Telangana",
    displayName: "VAHD Telangana",
    subName: "VETERINARY & ANIMAL HUSBANDRY",
    url: "/logos/vahd.png",
    heightClass: "h-[40px] md:h-[46px]",
  },
  {
    name: "Nizampet Municipal Corporation",
    displayName: "Nizampet Corporation",
    subName: "MUNICIPAL CORPORATION",
    url: "/logos/nizampet.png",
    heightClass: "h-[42px] md:h-[48px]",
  },
  {
    name: "Thumkunta Municipality",
    displayName: "Thumkunta Municipality",
    subName: "MUNICIPALITY (TELANGANA)",
    url: "/logos/thumkunta.png",
    heightClass: "h-[42px] md:h-[48px]",
  },
  {
    name: "Peerzadiguda Municipal Corporation",
    displayName: "Peerzadiguda (PMC)",
    subName: "MUNICIPAL CORPORATION",
    url: "/logos/peerzadiguda.png",
    heightClass: "h-[42px] md:h-[48px]",
  },
  {
    name: "Feedback Infra - Making Infrastructure Happen",
    displayName: "Feedback Infra",
    subName: "INFRASTRUCTURE ADVISORY",
    url: "/logos/feedback-infra.png",
    heightClass: "h-[32px] md:h-[36px]",
  },
];

export function TrustedBrandBlack({ className }: { className?: string }) {
  // 3 sets per group to easily span wide & ultrawide 4K monitors with seamless scroll
  const brandGroup = [...SCREENSHOT_BRANDS, ...SCREENSHOT_BRANDS, ...SCREENSHOT_BRANDS];

  return (
    <>
      <style>{`
        @keyframes brand-marquee-scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .brand-marquee-track {
          display: flex;
          width: max-content;
          animation: brand-marquee-scroll 48s linear infinite;
          will-change: transform;
        }
        .brand-marquee-track:hover {
          animation-play-state: paused;
        }
        @media (max-width: 768px) {
          .brand-marquee-track {
            animation-duration: 28s;
          }
        }
      `}</style>

      <section
        className={
          "w-full bg-[#f8fafd] -mt-3 sm:-mt-5 pt-1 sm:pt-1.5 pb-2 sm:pb-3 select-none relative z-20 border-y border-slate-200/80 " +
          (className || "")
        }
      >
        <div className="max-w-[1360px] 2xl:max-w-[1600px] 3xl:max-w-[1840px] mx-auto relative z-10 px-4 mb-1.5 text-center">
          <div className="inline-flex max-w-full items-center justify-center gap-1.5 sm:gap-2 px-3 py-0.5 rounded-full bg-white/80 border border-slate-200/90 shadow-2xs">
            <span className="size-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[9.5px] sm:text-[11px] font-bold uppercase tracking-wider sm:tracking-[0.14em] text-slate-600 leading-tight">
              Trusted by Municipal Corporations, Government Bodies &amp; Enterprise Leaders
            </p>
          </div>
        </div>

        {/* Continuous Smooth Infinite Marquee (Active on All Devices) */}
        <div className="w-full relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
          <div className="brand-marquee-track flex items-center py-0.5">
            {/* Primary Track */}
            <div className="flex shrink-0 items-center gap-[45px] sm:gap-[65px] md:gap-[85px] pr-[45px] sm:pr-[65px] md:pr-[85px]">
              {brandGroup.map((brand, idx) => (
                <div
                  key={`track1-${brand.name}-${idx}`}
                  className="flex flex-col items-center justify-center shrink-0 transition-all duration-300 hover:scale-105 gap-1 px-2 text-center group cursor-pointer"
                  title={brand.name}
                >
                  <div className="h-[44px] md:h-[50px] 2xl:h-[54px] flex items-center justify-center">
                    <img
                      src={brand.url}
                      alt={brand.name}
                      className={`${brand.heightClass} w-auto max-w-[140px] object-contain shrink-0 drop-shadow-xs transition-transform duration-300 group-hover:scale-105`}
                      loading="lazy"
                    />
                  </div>
                  <div className="flex flex-col items-center leading-tight">
                    <span className="text-[11.5px] sm:text-[12px] font-bold text-slate-800 tracking-tight whitespace-nowrap group-hover:text-purple-700 transition-colors">
                      {brand.displayName}
                    </span>
                    <span className="text-[9.5px] sm:text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono whitespace-nowrap mt-0.5">
                      {brand.subName}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Seamless Clone Track */}
            <div
              className="flex shrink-0 items-center gap-[45px] sm:gap-[65px] md:gap-[85px] pr-[45px] sm:pr-[65px] md:pr-[85px]"
              aria-hidden="true"
            >
              {brandGroup.map((brand, idx) => (
                <div
                  key={`track2-${brand.name}-${idx}`}
                  className="flex flex-col items-center justify-center shrink-0 transition-all duration-300 hover:scale-105 gap-1 px-2 text-center group cursor-pointer"
                  title={brand.name}
                >
                  <div className="h-[44px] md:h-[50px] 2xl:h-[54px] flex items-center justify-center">
                    <img
                      src={brand.url}
                      alt={brand.name}
                      className={`${brand.heightClass} w-auto max-w-[140px] object-contain shrink-0 drop-shadow-xs transition-transform duration-300 group-hover:scale-105`}
                      loading="lazy"
                    />
                  </div>
                  <div className="flex flex-col items-center leading-tight">
                    <span className="text-[11.5px] sm:text-[12px] font-bold text-slate-800 tracking-tight whitespace-nowrap group-hover:text-purple-700 transition-colors">
                      {brand.displayName}
                    </span>
                    <span className="text-[9.5px] sm:text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono whitespace-nowrap mt-0.5">
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
