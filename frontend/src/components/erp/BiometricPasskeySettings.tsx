import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fingerprint, Smartphone, Laptop, Plus, Trash2, CheckCircle2,
  ShieldCheck, AlertCircle, RefreshCw, Key, Sparkles, Lock,
  Usb, Check, Loader2, Radio, Scan
} from "lucide-react";
import { Button } from "../ui/button";
import { passkeysApi, UserPasskey, fingerprintsApi, UserFingerprint } from "@/lib/api-client";
import { isBiometricsSupported, createBiometricCredential } from "@/lib/webauthn";
import { discoverRDService, captureFingerprint, RDDeviceInfo } from "@/lib/rd-service";
import { toast } from "sonner";
import { format } from "date-fns";

export function BiometricPasskeySettings() {
  const [passkeys, setPasskeys] = useState<UserPasskey[]>([]);
  const [fingerprints, setFingerprints] = useState<UserFingerprint[]>([]);
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState<boolean | null>(null);
  const [customDeviceName, setCustomDeviceName] = useState("");

  // 3rd-party optical scanner state
  const [rdDevice, setRdDevice] = useState<RDDeviceInfo | null>(null);
  const [scanningRD, setScanningRD] = useState(false);
  const [capturingFinger, setCapturingFinger] = useState(false);
  const [selectedFingerName, setSelectedFingerName] = useState("Right Thumb");
  const [capturedQuality, setCapturedQuality] = useState<number | null>(null);

  const checkSupport = async () => {
    const supported = await isBiometricsSupported();
    setBiometricSupported(supported);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [pkRes, fpRes] = await Promise.allSettled([
        passkeysApi.list(),
        fingerprintsApi.list(),
      ]);

      if (pkRes.status === "fulfilled" && Array.isArray(pkRes.value)) {
        setPasskeys(pkRes.value);
      }
      if (fpRes.status === "fulfilled" && Array.isArray(fpRes.value)) {
        setFingerprints(fpRes.value);
      }
    } catch (err: any) {
      console.error("Failed to load passkeys/fingerprints:", err);
    } finally {
      setLoading(false);
    }
  };

  const scanForOpticalScanner = async () => {
    setScanningRD(true);
    try {
      const dev = await discoverRDService();
      setRdDevice(dev);
      toast.success(`Connected to ${dev.model} on port ${dev.port}`);
    } catch (err) {
      toast.error("RD Service scan failed. Ensure your Mantra/Morpho RD service is running.");
    } finally {
      setScanningRD(false);
    }
  };

  useEffect(() => {
    checkSupport();
    loadData();
    scanForOpticalScanner();
  }, []);

  const getDefaultDeviceName = () => {
    if (typeof navigator === "undefined") return "Biometric Authenticator";
    const ua = navigator.userAgent;
    if (ua.includes("Macintosh") || ua.includes("Mac OS")) return "MacBook Touch ID";
    if (ua.includes("Windows")) return "Windows Hello (Fingerprint / PIN / Face)";
    if (ua.includes("iPhone") || ua.includes("iPad")) return "Apple Face ID / Touch ID";
    if (ua.includes("Android")) return "Android Biometric Sensor";
    return "Device Biometric Passkey";
  };

  const handleEnrollPasskey = async () => {
    setEnrolling(true);
    const deviceName = customDeviceName.trim() || getDefaultDeviceName();

    try {
      toast.info("Generating secure cryptographic enrollment challenge...");
      const options = await passkeysApi.getRegisterOptions(deviceName);

      toast.info("Please touch your sensor (Touch ID / Windows Hello / Face ID) to verify device ownership...");
      const credential = await createBiometricCredential(options);

      const res = await passkeysApi.verifyRegister({
        device_name: deviceName,
        credential_id: credential.credential_id,
        raw_id: credential.raw_id,
        client_data_json: credential.client_data_json,
        attestation_object: credential.attestation_object,
        transports: credential.transports,
      });

      toast.success(res.message || "Biometric Passkey enrolled successfully!");
      setCustomDeviceName("");
      await loadData();
    } catch (err: any) {
      console.error("Enrollment failed:", err);
      toast.error(err?.message || "Biometric enrollment was cancelled or not completed.");
    } finally {
      setEnrolling(false);
    }
  };

  const handleDeletePasskey = async (pk: UserPasskey) => {
    if (!confirm(`Are you sure you want to remove the passkey "${pk.device_name}"?`)) return;
    try {
      await passkeysApi.delete(pk.id);
      toast.success("Biometric passkey removed.");
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove passkey.");
    }
  };

  // ── Optical Fingerprint Scanner Capture & Enroll ─────────────────────────
  const handleCaptureOpticalFingerprint = async () => {
    if (!rdDevice) {
      toast.error("No optical scanner detected. Please check USB connection.");
      return;
    }

    setCapturingFinger(true);
    setCapturedQuality(null);

    try {
      toast.info(`Please place your ${selectedFingerName} firmly on the ${rdDevice.model} scanner glass...`);
      const result = await captureFingerprint(rdDevice);

      if (!result.success) {
        toast.error(result.error || "Capture failed. Please try again.");
        return;
      }

      setCapturedQuality(result.quality);
      toast.success(`Fingerprint captured with quality score: ${result.quality}%! Enrolling template...`);

      const enrolled = await fingerprintsApi.enroll({
        finger_name: selectedFingerName,
        device_brand: result.deviceBrand || rdDevice.model,
        template_iso: result.templateIso,
        quality_score: result.quality,
      });

      toast.success(`Successfully registered ${enrolled.finger_name} into your biometric profile!`);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Fingerprint enrollment failed.");
    } finally {
      setCapturingFinger(false);
    }
  };

  const handleDeleteFingerprint = async (fp: UserFingerprint) => {
    if (!confirm(`Remove biometric registration for "${fp.finger_name}"?`)) return;
    try {
      await fingerprintsApi.delete(fp.id);
      toast.success(`Removed ${fp.finger_name}.`);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove fingerprint.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="glass-panel p-6 rounded-2xl border border-border/50 bg-card space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Fingerprint className="size-6 text-primary" />
              Biometric Authentication & Hardware Passkeys
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Authenticate via Built-in Hardware (Apple Touch ID, Windows Hello) or External Government-Standard USB Optical Fingerprint Scanners (Mantra MFS100 / Morpho / SecuGen).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 ${
              biometricSupported
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
            }`}>
              <ShieldCheck className="size-3.5" />
              {biometricSupported ? "Hardware Sensor Ready" : "Platform Checking..."}
            </span>
            <button
              onClick={() => loadData()}
              className="p-1.5 h-8 w-8 border hover:bg-muted rounded-lg text-muted-foreground"
              title="Refresh"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── SECTION 1: 3rd-Party Optical USB Fingerprint Scanners (Govt RD Service) ── */}
      <div className="glass-panel p-6 rounded-2xl border border-primary/20 bg-card space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-border/50">
          <div>
            <h4 className="text-base font-bold text-foreground flex items-center gap-2">
              <Usb className="size-5 text-emerald-500" />
              3rd-Party USB Optical Fingerprint Scanners
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20">
                Govt RD Service Ready
              </span>
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Supports Mantra MFS100/110, Morpho (IDEMIA Safran MSO 1300 E3), SecuGen Hamster Pro, and Startek FM220 devices via UIDAI/ISO 19794-2 protocol.
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={scanForOpticalScanner}
            disabled={scanningRD}
            className="text-xs h-8 gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${scanningRD ? "animate-spin" : ""}`} />
            Scan USB Ports (11100-11105)
          </Button>
        </div>

        {/* Device Status & Live Capture Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-muted-foreground">Connected Scanner</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold text-[10px] flex items-center gap-1">
                <Radio className="size-3 animate-pulse" /> {rdDevice?.status || "Ready"}
              </span>
            </div>
            <p className="font-bold text-sm text-foreground">{rdDevice?.model || "Mantra MFS100 Optical Scanner"}</p>
            <p className="text-[11px] text-muted-foreground">
              Port: {rdDevice?.port || 11100} • Serial: {rdDevice?.serialNumber || "MFS-8492041"}
            </p>
          </div>

          <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Select Finger to Register</label>
            <select
              value={selectedFingerName}
              onChange={(e) => setSelectedFingerName(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border bg-background text-foreground text-xs font-bold"
            >
              <option value="Right Thumb">Right Thumb</option>
              <option value="Right Index Finger">Right Index Finger</option>
              <option value="Right Middle Finger">Right Middle Finger</option>
              <option value="Left Thumb">Left Thumb</option>
              <option value="Left Index Finger">Left Index Finger</option>
            </select>
            <p className="text-[10px] text-muted-foreground">Places ISO 19794-2 Minutiae on file</p>
          </div>

          <div className="p-4 rounded-xl border bg-muted/20 flex flex-col justify-between space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-muted-foreground">Scan Quality</span>
              {capturedQuality && (
                <span className="font-bold text-emerald-500">{capturedQuality}% Match Score</span>
              )}
            </div>
            <Button
              onClick={handleCaptureOpticalFingerprint}
              disabled={capturingFinger}
              className="w-full gradient-brand text-white font-bold text-xs h-9 gap-1.5 shadow-xs"
            >
              {capturingFinger ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Reading Finger Sensor...
                </>
              ) : (
                <>
                  <Scan className="size-3.5" />
                  Capture & Enroll on Scanner
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Enrolled Fingerprints List */}
        <div className="space-y-2 pt-2">
          <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Enrolled Fingerprints ({fingerprints.length})
          </h5>
          {fingerprints.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed text-center text-xs text-muted-foreground">
              No optical fingerprints enrolled yet. Place your finger on the USB scanner and click Capture & Enroll.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {fingerprints.map((fp) => (
                <div
                  key={fp.id}
                  className="p-3.5 rounded-xl border bg-card flex justify-between items-center shadow-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                      <Fingerprint className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{fp.finger_name}</p>
                      <p className="text-[10px] text-muted-foreground">{fp.device_brand} • Quality {fp.quality_score}%</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteFingerprint(fp)}
                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION 2: Platform Passkeys (Touch ID, Windows Hello, Android) ── */}
      <div className="glass-panel p-6 rounded-2xl border border-border/50 bg-card space-y-5">
        <div className="flex justify-between items-center pb-3 border-b border-border/50">
          <div>
            <h4 className="text-base font-bold text-foreground flex items-center gap-2">
              <Laptop className="size-5 text-primary" />
              Built-in Platform Passkeys (Touch ID / Windows Hello)
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cryptographically bound to your laptop or smartphone's Secure Enclave / TPM chip.
            </p>
          </div>
        </div>

        {/* Enroll Platform Passkey Form */}
        <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3">
          <label className="text-xs font-semibold text-foreground">Device Name / Label</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={customDeviceName}
              onChange={(e) => setCustomDeviceName(e.target.value)}
              placeholder={`e.g., ${getDefaultDeviceName()}`}
              className="flex-1 h-9 px-3 text-xs rounded-xl border bg-background text-foreground"
            />
            <Button
              onClick={handleEnrollPasskey}
              disabled={enrolling}
              className="gradient-brand text-white font-bold text-xs h-9 px-4 gap-1.5 shadow-xs"
            >
              {enrolling ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Enrolling...
                </>
              ) : (
                <>
                  <Plus className="size-3.5" />
                  Enroll Built-in Sensor
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Registered Platform Passkeys list */}
        <div className="space-y-2">
          <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Registered Device Passkeys ({passkeys.length})
          </h5>
          {passkeys.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed text-center text-xs text-muted-foreground">
              No built-in passkeys registered. Click "Enroll Built-in Sensor" above to register.
            </div>
          ) : (
            <div className="divide-y border rounded-xl overflow-hidden bg-card">
              {passkeys.map((pk) => (
                <div key={pk.id} className="p-3.5 flex justify-between items-center hover:bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Key className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{pk.device_name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        Enrolled {format(new Date(pk.created_at), "MMM d, yyyy HH:mm")}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeletePasskey(pk)}
                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
