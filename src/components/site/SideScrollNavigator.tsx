"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

export function SideScrollNavigator() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [activeSection, setActiveSection] = useState("Home");

  const trackRef = useRef<HTMLDivElement>(null);
  const TRACK_HEIGHT = 150; // pixels
  const THUMB_HEIGHT = 32; // pixels
  const TRAVEL_DISTANCE = TRACK_HEIGHT - THUMB_HEIGHT;

  // Calculate current scroll progress & active section
  const updateScroll = useCallback(() => {
    if (isDragging) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight =
      document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const progress = docHeight > 0 ? Math.min(1, Math.max(0, scrollTop / docHeight)) : 0;
    setScrollProgress(progress);

    // Section detection
    const sections = [
      { id: "contact", label: "Contact" },
      { id: "about", label: "About" },
      { id: "security", label: "Security" },
      { id: "analytics", label: "Analytics" },
      { id: "industries", label: "Verticals" },
      { id: "features", label: "Intelligence" },
      { id: "applications", label: "Applications" },
      { id: "services", label: "Services" },
      { id: "home", label: "Home" },
    ];

    const scrollPos = scrollTop + 160;
    for (const sec of sections) {
      const el = document.getElementById(sec.id);
      if (el) {
        const top = el.getBoundingClientRect().top + scrollTop;
        if (scrollPos >= top) {
          setActiveSection(sec.label);
          break;
        }
      }
    }
  }, [isDragging]);

  useEffect(() => {
    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", updateScroll, { passive: true });
    updateScroll();
    return () => {
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
    };
  }, [updateScroll]);

  // Scroll to Top
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Scroll to Bottom
  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
  };

  // Scroll based on pointer position within the track
  const scrubToClientY = useCallback((clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    const clampedY = Math.min(
      TRAVEL_DISTANCE,
      Math.max(0, relativeY - THUMB_HEIGHT / 2)
    );
    const progress = clampedY / TRAVEL_DISTANCE;

    setScrollProgress(progress);

    const docHeight =
      document.documentElement.scrollHeight - document.documentElement.clientHeight;
    window.scrollTo({
      top: progress * docHeight,
      behavior: "auto",
    });
  }, [TRAVEL_DISTANCE]);

  // Pointer down on the track or thumb
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    scrubToClientY(e.clientY);
  };

  // Pointer move while dragging
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();
    scrubToClientY(e.clientY);
  };

  // Pointer up to release drag
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
  };

  const thumbTop = Math.round(scrollProgress * TRAVEL_DISTANCE);
  const percentNumber = Math.round(scrollProgress * 100);

  return (
    <>
      {/* 1. Desktop Interactive Side Scroll Navigator Dock (>= md) */}
      <aside
        aria-label="Website Side Scroll Navigator"
        className="hidden md:flex fixed right-3 sm:right-4.5 top-1/2 -translate-y-1/2 z-50 flex-col items-center select-none"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex flex-col items-center gap-2 p-1.5 rounded-full bg-white/92 dark:bg-slate-900/92 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 shadow-[0_12px_40px_-5px_rgba(0,0,0,0.18)] transition-all duration-300 hover:shadow-[0_16px_50px_-5px_rgba(124,58,237,0.22)]">
          {/* Top Arrow Button */}
          <button
            type="button"
            onClick={scrollToTop}
            aria-label="Scroll to top of website"
            className="group relative flex items-center justify-center size-9 rounded-full bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-gradient-to-tr hover:from-purple-600 hover:to-indigo-600 hover:text-white transition-all duration-200 hover:scale-110 active:scale-95 shadow-2xs cursor-pointer"
          >
            <ChevronUp className="size-4.5 transition-transform duration-200 group-hover:-translate-y-0.5" />
            {/* Tooltip */}
            <span className="absolute right-full mr-3.5 px-2.5 py-1 rounded-md bg-slate-950 text-white text-[11px] font-bold tracking-wide whitespace-nowrap opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200 pointer-events-none shadow-xl border border-white/10 z-50">
              Scroll to Top
              <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-950" />
            </span>
          </button>

          {/* Draggable Scroll Track & Thumb */}
          <div
            ref={trackRef}
            style={{ height: `${TRACK_HEIGHT}px` }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`relative w-8 rounded-full flex justify-center cursor-pointer touch-none transition-colors duration-200 ${
              isDragging
                ? "bg-purple-100/60 dark:bg-purple-950/40"
                : "bg-slate-100/60 dark:bg-slate-800/60 hover:bg-slate-200/60 dark:hover:bg-slate-800/90"
            }`}
            title="Drag to scroll anywhere on the website"
          >
            {/* Inner Center Rail */}
            <div className="absolute top-2 bottom-2 w-1.5 rounded-full bg-slate-200/90 dark:bg-slate-700/80" />

            {/* Draggable Thumb */}
            <div
              style={{
                top: `${thumbTop}px`,
                height: `${THUMB_HEIGHT}px`,
              }}
              className={`absolute left-1 right-1 rounded-full flex flex-col items-center justify-center cursor-grab active:cursor-grabbing transition-shadow duration-150 ${
                isDragging
                  ? "bg-gradient-to-b from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/40 ring-2 ring-purple-400"
                  : "bg-gradient-to-b from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/25 hover:brightness-110"
              }`}
            >
              {/* Grip Indicator Dots */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="size-1 rounded-full bg-white/90" />
                <span className="size-1 rounded-full bg-white/90" />
                <span className="size-1 rounded-full bg-white/90" />
              </div>
            </div>

            {/* Live Percentage & Section Tooltip (Appears when hovered or dragging) */}
            <div
              style={{
                top: `${thumbTop + THUMB_HEIGHT / 2}px`,
              }}
              className={`absolute right-full mr-3.5 -translate-y-1/2 px-2.5 py-1 rounded-md bg-slate-950 text-white text-[11px] font-bold tracking-wide whitespace-nowrap pointer-events-none shadow-xl border border-white/10 z-50 flex items-center gap-1.5 transition-all duration-200 ${
                isHovered || isDragging
                  ? "opacity-100 -translate-x-0"
                  : "opacity-0 -translate-x-1"
              }`}
            >
              <span className="text-purple-300 font-mono">{percentNumber}%</span>
              <span className="text-slate-400">·</span>
              <span>{activeSection}</span>
              <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-950" />
            </div>
          </div>

          {/* Bottom Arrow Button */}
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to bottom of website"
            className="group relative flex items-center justify-center size-9 rounded-full bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-gradient-to-tr hover:from-purple-600 hover:to-indigo-600 hover:text-white transition-all duration-200 hover:scale-110 active:scale-95 shadow-2xs cursor-pointer"
          >
            <ChevronDown className="size-4.5 transition-transform duration-200 group-hover:translate-y-0.5" />
            {/* Tooltip */}
            <span className="absolute right-full mr-3.5 px-2.5 py-1 rounded-md bg-slate-950 text-white text-[11px] font-bold tracking-wide whitespace-nowrap opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200 pointer-events-none shadow-xl border border-white/10 z-50">
              Scroll to Bottom
              <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-950" />
            </span>
          </button>
        </div>
      </aside>

      {/* 2. Mobile Quick Scroll Buttons (< md) */}
      <div className="md:hidden fixed right-4 bottom-20 z-40 flex flex-col items-center gap-2 select-none">
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Scroll to top"
          className="size-9 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 flex items-center justify-center shadow-lg active:scale-95"
        >
          <ChevronUp className="size-4.5 text-purple-600" />
        </button>
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
          className="size-9 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 flex items-center justify-center shadow-lg active:scale-95"
        >
          <ChevronDown className="size-4.5 text-purple-600" />
        </button>
      </div>
    </>
  );
}
