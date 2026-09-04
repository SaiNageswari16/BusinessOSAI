import React from 'react';
import { ArrowLeft, Shield, Lock, FileText, ExternalLink, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-navy-900/80 backdrop-blur-md border-b border-navy-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">BusinessOS AI Privacy Policy</h1>
              <p className="text-xs text-slate-400">Biometric & Health Telemetry Data Governance</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 bg-navy-800 px-3 py-1.5 rounded-full border border-navy-700">
            Effective: Aug 28, 2026
          </span>
          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-medium text-xs transition-colors shadow-lg shadow-brand-600/20"
          >
            <ExternalLink className="w-4 h-4" />
            Full HTML Document
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-navy-900/60 border border-navy-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl mb-8">
          <div className="flex items-center gap-3 text-brand-400 mb-3">
            <Lock className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Enterprise Compliance Standard</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-4">Privacy & Biometric Data Governance Statement</h2>
          <p className="text-slate-300 leading-relaxed text-sm">
            This document sets forth the complete operational and legal framework governing the collection, biometric vector hashing,
            body composition telemetry processing, retention schedules, and data subject privacy rights across BusinessOS AI SaaS platforms,
            integrated eSSL eBioserver middleware, and IoT health scanner devices.
          </p>
        </div>

        <div className="space-y-8 text-slate-300 text-sm leading-relaxed">
          {/* Quick Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-navy-900/80 border border-navy-800 rounded-xl p-5">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-lg mb-3">
                01
              </div>
              <h3 className="font-bold text-white mb-1">Zero Raw Images</h3>
              <p className="text-xs text-slate-400">Facial photos and fingerprint images are converted into non-reversible mathematical vector hashes at the hardware layer.</p>
            </div>

            <div className="bg-navy-900/80 border border-navy-800 rounded-xl p-5">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-lg mb-3">
                02
              </div>
              <h3 className="font-bold text-white mb-1">30-Day Auto Purge</h3>
              <p className="text-xs text-slate-400">Biometric vector hashes are automatically purged from hardware & DB memory within 30 days of membership cancellation.</p>
            </div>

            <div className="bg-navy-900/80 border border-navy-800 rounded-xl p-5">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-lg mb-3">
                03
              </div>
              <h3 className="font-bold text-white mb-1">FIPS AES-256</h3>
              <p className="text-xs text-slate-400">All health telemetry and InBody scan logs are encrypted at rest with AES-256 and transmitted over TLS 1.3 encrypted tunnels.</p>
            </div>
          </div>

          {/* Embedded Full HTML Link Notification */}
          <div className="p-6 rounded-xl bg-navy-900 border border-brand-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-white text-base mb-1">View Complete 3,500+ Word Statutory Legal Policy</h4>
              <p className="text-xs text-slate-400">Includes BIPA (Illinois 740 ILCS 14/), GDPR Art. 9, CCPA/CPRA, and HIPAA alignment statutory clauses.</p>
            </div>
            <a
              href="/privacy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-white font-semibold text-xs transition-colors shrink-0 flex items-center gap-2"
            >
              Open Full HTML Policy <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
