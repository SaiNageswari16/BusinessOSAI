import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  Laptop,
  Smartphone,
  CheckCircle2,
  Share2,
  PlusSquare,
  Sparkles,
  Info,
  Check
} from 'lucide-react';

interface DownloadAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DownloadAppModal({ isOpen, onClose }: DownloadAppModalProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'windows' | 'apple'>('all');

  const windowsExeUrl = '/downloads/BusinessOS-AI-Setup-1.0.0.exe';
  const macosDmgUrl = '/downloads/BusinessOS-AI-1.0.0.dmg';

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white border border-slate-200/90 rounded-3xl shadow-2xl text-slate-900 z-10 my-auto custom-scrollbar"
        >
          {/* Subtle Ambient Background Accents */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Modal Header */}
          <div className="sticky top-0 z-20 flex items-center justify-between p-6 pb-4 bg-white/95 backdrop-blur-md border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-500 rounded-2xl blur-sm opacity-50" />
                <img
                  src="/iotroncs-mark.png"
                  alt="IoTRONCS"
                  className="relative size-11 rounded-xl object-contain bg-white p-1 border border-slate-200 shadow-sm"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black tracking-tight text-slate-900">
                    Download BusinessOS <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-teal-500 to-purple-600">AI</span>
                  </h2>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-black text-emerald-700 tracking-wider uppercase">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    v1.0.0 Ready
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Native desktop installers for Windows and macOS, plus iOS Web App
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="size-9 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200/60 flex items-center justify-center text-slate-500 hover:text-slate-800 transition active:scale-95 cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200/70 w-fit">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="size-3.5" /> All Platforms
              </button>
              <button
                onClick={() => setActiveTab('windows')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'windows'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Laptop className="size-3.5" /> Windows Desktop
              </button>
              <button
                onClick={() => setActiveTab('apple')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'apple'
                    ? 'bg-gradient-to-r from-purple-600 to-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="size-3.5" /> macOS & iOS
              </button>
            </div>

            {/* Showcase Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ───────────────────────────────────────────────────────────── */}
              {/* WINDOWS CARD                                                  */}
              {/* ───────────────────────────────────────────────────────────── */}
              {(activeTab === 'all' || activeTab === 'windows') && (
                <div className="relative group rounded-3xl bg-gradient-to-b from-cyan-50/60 to-white border border-cyan-200/90 p-6 flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-xl hover:border-cyan-400/80 transition-all duration-300">
                  <div className="absolute top-0 right-0 px-3 py-1 bg-cyan-100 border-b border-l border-cyan-200 text-[10px] font-black text-cyan-800 rounded-bl-2xl">
                    Windows 10 / 11 (64-bit)
                  </div>

                  <div>
                    {/* Header with Windows Vector Logo */}
                    <div className="flex items-center gap-3.5 mb-4">
                      <div className="size-14 rounded-2xl bg-cyan-100/80 border border-cyan-200 flex items-center justify-center text-cyan-600 shadow-inner group-hover:scale-105 transition-transform">
                        <svg className="size-7 fill-current" viewBox="0 0 24 24">
                          <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4h-13.051M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.95" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900">Windows Desktop App</h3>
                        <p className="text-xs text-cyan-700 font-semibold">Official 64-bit Setup Installer</p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed mb-4">
                      Native Windows application with automated setup wizard. Automatically installs desktop & start menu shortcuts with thermal printer & barcode scanner hardware sync.
                    </p>

                    {/* Feature Bullets */}
                    <ul className="space-y-2 mb-6 text-xs text-slate-700">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-cyan-600 shrink-0" />
                        <span>Direct <strong>.exe</strong> installer with automated desktop icon</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-cyan-600 shrink-0" />
                        <span>High-Speed POS, offline caching & full screen kiosk mode</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-cyan-600 shrink-0" />
                        <span>Auto-sync with BusinessOS AI cloud backend</span>
                      </li>
                    </ul>
                  </div>

                  {/* Primary Download Action */}
                  <div className="pt-2">
                    <a
                      href={windowsExeUrl}
                      download="BusinessOS-AI-Setup-1.0.0.exe"
                      className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/25 transition active:scale-[0.98]"
                    >
                      <Download className="size-4.5" />
                      <span>Download Windows App (.exe)</span>
                    </a>
                    <p className="text-center text-[10px] text-slate-400 mt-2 font-medium">
                      File: BusinessOS-AI-Setup-1.0.0.exe • 75 MB
                    </p>
                  </div>
                </div>
              )}

              {/* ───────────────────────────────────────────────────────────── */}
              {/* MACOS & IOS CARD                                              */}
              {/* ───────────────────────────────────────────────────────────── */}
              {(activeTab === 'all' || activeTab === 'apple') && (
                <div className="relative group rounded-3xl bg-gradient-to-b from-purple-50/60 to-white border border-purple-200/90 p-6 flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-xl hover:border-purple-400/80 transition-all duration-300">
                  <div className="absolute top-0 right-0 px-3 py-1 bg-purple-100 border-b border-l border-purple-200 text-[10px] font-black text-purple-800 rounded-bl-2xl">
                    macOS (Apple Silicon & Intel)
                  </div>

                  <div>
                    {/* Header with Apple Vector Logo */}
                    <div className="flex items-center gap-3.5 mb-4">
                      <div className="size-14 rounded-2xl bg-purple-100/80 border border-purple-200 flex items-center justify-center text-purple-600 shadow-inner group-hover:scale-105 transition-transform">
                        <svg className="size-7 fill-current" viewBox="0 0 24 24">
                          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.85-.9.04-2 0.6-2.65 1.35-.58.66-1.09 1.73-0.95 2.76 1.01.08 2.05-.51 2.68-1.26z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900">Apple macOS App</h3>
                        <p className="text-xs text-purple-700 font-semibold">Native Apple Disk Image (.dmg)</p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed mb-4">
                      Optimized for Apple Silicon (M1/M2/M3/M4) & Intel Macs. Mount the disk image and drag BusinessOS AI straight into your Applications folder with native menu bar integration.
                    </p>

                    {/* Feature Bullets */}
                    <ul className="space-y-2 mb-6 text-xs text-slate-700">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-purple-600 shrink-0" />
                        <span>Direct <strong>.dmg</strong> disk image installer with Retina icon</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-purple-600 shrink-0" />
                        <span>Smooth macOS native gestures, dock & full screen support</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-purple-600 shrink-0" />
                        <span>iPhone & iPad web touch app compatible</span>
                      </li>
                    </ul>
                  </div>

                  {/* Primary Download Action */}
                  <div className="pt-2">
                    <a
                      href={macosDmgUrl}
                      download="BusinessOS-AI-1.0.0.dmg"
                      className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 transition active:scale-[0.98]"
                    >
                      <Download className="size-4.5" />
                      <span>Download macOS App (.dmg)</span>
                    </a>
                    <p className="text-center text-[10px] text-slate-400 mt-2 font-medium">
                      File: BusinessOS-AI-1.0.0.dmg • 91 MB
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ───────────────────────────────────────────────────────────── */}
            {/* MACOS FIRST-TIME OPEN GUIDANCE BANNER                          */}
            {/* ───────────────────────────────────────────────────────────── */}
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-left text-xs text-amber-900 flex items-start gap-3 shadow-sm">
              <div className="size-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                <Info className="size-4" />
              </div>
              <div>
                <span className="font-bold text-amber-950 block mb-0.5">First-time open on macOS:</span>
                <span>
                  If macOS shows an unverified developer prompt, simply <strong>Right-Click (Control+Click)</strong> the app and click <strong>Open → Open Anyway</strong>, or go to <strong>System Settings → Privacy & Security → Open Anyway</strong>.
                </span>
              </div>
            </div>

            {/* ───────────────────────────────────────────────────────────── */}
            {/* IOS WEB APP ADD TO HOME SCREEN VISUAL GUIDE                   */}
            {/* ───────────────────────────────────────────────────────────── */}
            <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="size-4 text-emerald-600" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                    How to install BusinessOS AI on iPhone & iPad (iOS Web App)
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-500">Takes 5 Seconds</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 space-y-1 shadow-sm">
                  <div className="size-6 rounded-lg bg-emerald-100 text-emerald-700 font-black text-xs flex items-center justify-center">
                    1
                  </div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    Tap Share <Share2 className="size-3.5 text-cyan-600" />
                  </div>
                  <div className="text-[11px] text-slate-500 leading-tight">
                    In Safari browser on your iPhone or iPad, tap the Share icon at the bottom of the screen.
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 space-y-1 shadow-sm">
                  <div className="size-6 rounded-lg bg-cyan-100 text-cyan-700 font-black text-xs flex items-center justify-center">
                    2
                  </div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    "Add to Home Screen" <PlusSquare className="size-3.5 text-purple-600" />
                  </div>
                  <div className="text-[11px] text-slate-500 leading-tight">
                    Scroll down the action sheet and select <strong>"Add to Home Screen"</strong>.
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 space-y-1 shadow-sm">
                  <div className="size-6 rounded-lg bg-purple-100 text-purple-700 font-black text-xs flex items-center justify-center">
                    3
                  </div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    Tap "Add" <Check className="size-3.5 text-emerald-600" />
                  </div>
                  <div className="text-[11px] text-slate-500 leading-tight">
                    Confirm by tapping <strong>Add</strong>. The official BusinessOS AI app icon is placed on your home screen!
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
