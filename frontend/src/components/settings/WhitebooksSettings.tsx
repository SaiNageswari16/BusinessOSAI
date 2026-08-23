import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Server,
  FileSpreadsheet,
  Truck,
  FileCheck,
  ExternalLink,
  Save,
  RotateCw,
  Info,
  Key,
} from 'lucide-react';
import { whitebooksSettingsApi } from '@/lib/api-client';
import { toast } from 'sonner';

interface ModuleConfig {
  client_id: string;
  client_secret: string;
  username: string;
  password: string;
  gstin: string;
  base_url?: string;
  is_configured?: boolean;
}

export function WhitebooksSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Environment & IP
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [ipAddress, setIpAddress] = useState('106.213.64.83');

  // 3 Distinct Module Credentials
  const [ewb, setEwb] = useState<ModuleConfig>({
    client_id: '',
    client_secret: '',
    username: '',
    password: '',
    gstin: '',
  });

  const [gst, setGst] = useState<ModuleConfig>({
    client_id: '',
    client_secret: '',
    username: '',
    password: '',
    gstin: '',
  });

  const [einv, setEinv] = useState<ModuleConfig>({
    client_id: '',
    client_secret: '',
    username: '',
    password: '',
    gstin: '',
  });

  // Password Visibility States
  const [showEwbSecret, setShowEwbSecret] = useState(false);
  const [showEwbPass, setShowEwbPass] = useState(false);
  const [showGstSecret, setShowGstSecret] = useState(false);
  const [showGstPass, setShowGstPass] = useState(false);
  const [showEinvSecret, setShowEinvSecret] = useState(false);
  const [showEinvPass, setShowEinvPass] = useState(false);

  // Diagnostic Test States
  const [testingModule, setTestingModule] = useState<'ewb' | 'gst' | 'einv' | null>(null);
  const [testResults, setTestResults] = useState<{
    ewb?: { success: boolean; message: string; timestamp?: string; token_preview?: string };
    gst?: { success: boolean; message: string; timestamp?: string; token_preview?: string };
    einv?: { success: boolean; message: string; timestamp?: string; token_preview?: string };
  }>({});

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await whitebooksSettingsApi.getConfig();
      if (res) {
        setEnvironment(res.environment || 'sandbox');
        setIpAddress(res.ip_address || '106.213.64.83');
        if (res.ewb) setEwb(res.ewb);
        if (res.gst) setGst(res.gst);
        if (res.einv) setEinv(res.einv);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load Whitebooks settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        environment,
        ip_address: ipAddress,
        ewb,
        gst,
        einv,
      };
      const res = await whitebooksSettingsApi.saveConfig(payload);
      if (res && res.success) {
        toast.success('Whitebooks 3-Module credentials saved successfully!');
      } else {
        toast.error(res?.message || 'Failed to save configuration');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Error saving Whitebooks configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (module: 'ewb' | 'gst' | 'einv') => {
    setTestingModule(module);
    try {
      const credentials = {
        environment,
        ip_address: ipAddress,
        ewb,
        gst,
        einv,
      };
      const res = await whitebooksSettingsApi.testConnection(module, credentials);
      setTestResults((prev) => ({
        ...prev,
        [module]: {
          success: res?.success || false,
          message: res?.message || (res?.success ? 'Connected successfully' : 'Authentication failed'),
          timestamp: new Date().toLocaleTimeString(),
          token_preview: res?.token_preview,
        },
      }));
      if (res?.success) {
        toast.success(`${res.module || module.toUpperCase()} connection test successful!`);
      } else {
        toast.error(`${module.toUpperCase()}: ${res?.message || 'Connection test failed'}`);
      }
    } catch (e: any) {
      setTestResults((prev) => ({
        ...prev,
        [module]: {
          success: false,
          message: e?.message || 'Connection timeout or invalid credentials',
          timestamp: new Date().toLocaleTimeString(),
        },
      }));
      toast.error(`Test failed for ${module.toUpperCase()}: ${e?.message}`);
    } finally {
      setTestingModule(null);
    }
  };

  const handleLoadDemoSandbox = () => {
    setEnvironment('sandbox');
    setIpAddress('106.213.64.83');
    setEwb({
      client_id: 'EWBSb8a4ced2-50fd-4ec9-af8b-d20518af7a52',
      client_secret: 'EWBS71804adb-a3fc-4fa7-9bf1-39d0687d5505',
      username: 'BVMGSP',
      password: 'Wbooks@0142',
      gstin: '29AAGCB1286Q000',
    });
    setGst({
      client_id: 'GSTS478f82bc-958c-4da6-a6b5-c87afd7b2ad7',
      client_secret: 'GSTS897fbdc8-e45f-4598-9fd1-1150e606d4d5',
      username: 'TN_NT2.152383',
      password: 'Wbooks@0142',
      gstin: '33AAGCB1286Q1ZB',
    });
    setEinv({
      client_id: 'EINS234e6aff-d9f9-4369-baad-1c33af717043',
      client_secret: 'EINS5eb933db-6591-48b7-ab15-e59477010d4c',
      username: 'BVMGSP',
      password: 'Wbooks@0142',
      gstin: '29AAGCB1286Q000',
    });
    toast.success('Loaded active Whitebooks Sandbox credentials from portal');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        <span className="text-sm font-semibold">Loading Whitebooks GSP Configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-emerald-500/20 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4" /> GST Suvidha Provider (GSP) Gateway
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Whitebooks Multi-Module API Integration
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl mt-1">
              Connect separate statutory credentials for <strong>e-Way Bill</strong>, <strong>GST Returns (GSTR-1/3B)</strong>, and <strong>e-Invoice (IRN)</strong>. Run automated real-time diagnostics per module.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleLoadDemoSandbox}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RotateCw className="w-3.5 h-3.5" /> Auto-Fill Sandbox
            </button>
            <a
              href="https://developer.whitebooks.in"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-lg"
            >
              Portal Docs <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Global Environment & Mode Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Target Gateway Environment</h4>
            <p className="text-xs text-slate-500">
              Active: <span className="font-mono font-semibold">{environment === 'production' ? 'https://api.whitebooks.in' : 'https://apisandbox.whitebooks.in'}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setEnvironment('sandbox')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                environment === 'sandbox'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🟡 SandBox
            </button>
            <button
              type="button"
              onClick={() => setEnvironment('production')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                environment === 'production'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🟢 Production
            </button>
          </div>
          <div className="hidden md:flex items-center gap-2 border-l border-slate-200 pl-4">
            <span className="text-xs text-slate-500 font-semibold">Registered IP:</span>
            <input
              type="text"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              className="px-2.5 py-1 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg w-28 text-slate-700"
            />
          </div>
        </div>
      </div>

      {/* 3 Modular Credential Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── MODULE 1: e-Way Bill API ────────────────────────────── */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">1. e-Way Bill API</h3>
                  <p className="text-[11px] text-slate-500">/ewaybillapis Module</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                EWB
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  EWB Client ID
                </label>
                <input
                  type="text"
                  placeholder="EWBS..."
                  value={ewb.client_id}
                  onChange={(e) => setEwb({ ...ewb, client_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  EWB Client Secret
                </label>
                <div className="relative">
                  <input
                    type={showEwbSecret ? 'text' : 'password'}
                    placeholder="••••••••••••••••"
                    value={ewb.client_secret}
                    onChange={(e) => setEwb({ ...ewb, client_secret: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEwbSecret(!showEwbSecret)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showEwbSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Portal Username
                  </label>
                  <input
                    type="text"
                    value={ewb.username}
                    onChange={(e) => setEwb({ ...ewb, username: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showEwbPass ? 'text' : 'password'}
                      value={ewb.password}
                      onChange={(e) => setEwb({ ...ewb, password: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none pr-7"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEwbPass(!showEwbPass)}
                      className="absolute right-2 top-2 text-slate-400"
                    >
                      {showEwbPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Taxpayer GSTIN
                </label>
                <input
                  type="text"
                  maxLength={15}
                  placeholder="29AAGCB1286Q000"
                  value={ewb.gstin}
                  onChange={(e) => setEwb({ ...ewb, gstin: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold uppercase bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none"
                />
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
            <button
              type="button"
              disabled={testingModule === 'ewb'}
              onClick={() => handleTestConnection('ewb')}
              className="w-full py-2 px-3 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
            >
              {testingModule === 'ewb' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-amber-500" />
              )}
              Test E-Way Bill Connection
            </button>
            {testResults.ewb && (
              <div
                className={`p-2.5 rounded-xl text-[11px] font-medium flex items-start gap-2 ${
                  testResults.ewb.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {testResults.ewb.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">{testResults.ewb.message}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Checked at {testResults.ewb.timestamp}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── MODULE 2: GST Returns & Filing API ──────────────────── */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">2. GST Returns API</h3>
                  <p className="text-[11px] text-slate-500">/gstapis Module (GSTR-1/3B)</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                GST
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  GST Client ID
                </label>
                <input
                  type="text"
                  placeholder="GSTS..."
                  value={gst.client_id}
                  onChange={(e) => setGst({ ...gst, client_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  GST Client Secret
                </label>
                <div className="relative">
                  <input
                    type={showGstSecret ? 'text' : 'password'}
                    placeholder="••••••••••••••••"
                    value={gst.client_secret}
                    onChange={(e) => setGst({ ...gst, client_secret: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGstSecret(!showGstSecret)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showGstSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    GST Portal User
                  </label>
                  <input
                    type="text"
                    value={gst.username}
                    onChange={(e) => setGst({ ...gst, username: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showGstPass ? 'text' : 'password'}
                      value={gst.password}
                      onChange={(e) => setGst({ ...gst, password: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none pr-7"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGstPass(!showGstPass)}
                      className="absolute right-2 top-2 text-slate-400"
                    >
                      {showGstPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Taxpayer GSTIN
                </label>
                <input
                  type="text"
                  maxLength={15}
                  placeholder="29AAGCB1286Q000"
                  value={gst.gstin}
                  onChange={(e) => setGst({ ...gst, gstin: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold uppercase bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none"
                />
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
            <button
              type="button"
              disabled={testingModule === 'gst'}
              onClick={() => handleTestConnection('gst')}
              className="w-full py-2 px-3 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
            >
              {testingModule === 'gst' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-amber-500" />
              )}
              Test GST Returns Connection
            </button>
            {testResults.gst && (
              <div
                className={`p-2.5 rounded-xl text-[11px] font-medium flex items-start gap-2 ${
                  testResults.gst.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {testResults.gst.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">{testResults.gst.message}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Checked at {testResults.gst.timestamp}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── MODULE 3: e-Invoice & IRN API ───────────────────────── */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-50 text-purple-700 rounded-xl">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">3. e-Invoice & IRN</h3>
                  <p className="text-[11px] text-slate-500">/einvoiceapis Module</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                EINV
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  e-Invoice Client ID
                </label>
                <input
                  type="text"
                  placeholder="EINVS..."
                  value={einv.client_id}
                  onChange={(e) => setEinv({ ...einv, client_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  e-Invoice Secret
                </label>
                <div className="relative">
                  <input
                    type={showEinvSecret ? 'text' : 'password'}
                    placeholder="••••••••••••••••"
                    value={einv.client_secret}
                    onChange={(e) => setEinv({ ...einv, client_secret: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEinvSecret(!showEinvSecret)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showEinvSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    IRP Username
                  </label>
                  <input
                    type="text"
                    value={einv.username}
                    onChange={(e) => setEinv({ ...einv, username: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showEinvPass ? 'text' : 'password'}
                      value={einv.password}
                      onChange={(e) => setEinv({ ...einv, password: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none pr-7"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEinvPass(!showEinvPass)}
                      className="absolute right-2 top-2 text-slate-400"
                    >
                      {showEinvPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Taxpayer GSTIN
                </label>
                <input
                  type="text"
                  maxLength={15}
                  placeholder="29AAGCB1286Q000"
                  value={einv.gstin}
                  onChange={(e) => setEinv({ ...einv, gstin: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold uppercase bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none"
                />
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
            <button
              type="button"
              disabled={testingModule === 'einv'}
              onClick={() => handleTestConnection('einv')}
              className="w-full py-2 px-3 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
            >
              {testingModule === 'einv' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-amber-500" />
              )}
              Test e-Invoice & IRN Connection
            </button>
            {testResults.einv && (
              <div
                className={`p-2.5 rounded-xl text-[11px] font-medium flex items-start gap-2 ${
                  testResults.einv.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {testResults.einv.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">{testResults.einv.message}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Checked at {testResults.einv.timestamp}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Action Bar */}
      <div className="sticky bottom-6 z-20 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Info className="w-4 h-4 text-emerald-400" />
          <span>Credentials are encrypted and securely scoped to your active organization workspace.</span>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg cursor-pointer"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save 3-Module Configuration
        </button>
      </div>
    </div>
  );
}
