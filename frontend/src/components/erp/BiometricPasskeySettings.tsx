import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Fingerprint, Smartphone, Laptop, Plus, Trash2, CheckCircle2,
  ShieldCheck, AlertCircle, RefreshCw, Key, Sparkles, Lock
} from "lucide-react";
import { Button } from "../ui/button";
import { passkeysApi, UserPasskey } from "@/lib/api-client";
import { isBiometricsSupported, createBiometricCredential } from "@/lib/webauthn";
import { toast } from "sonner";
import { format } from "date-fns";

export function BiometricPasskeySettings() {
  const [passkeys, setPasskeys] = useState<UserPasskey[]>([]);
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState<boolean | null>(null);
  const [customDeviceName, setCustomDeviceName] = useState("");

  const checkSupport = async () => {
    const supported = await isBiometricsSupported();
    setBiometricSupported(supported);
  };

  const loadPasskeys = async () => {
    setLoading(true);
    try {
      const data = await passkeysApi.list();
      setPasskeys(data);
    } catch (err: any) {
      console.error("Failed to load passkeys:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSupport();
    loadPasskeys();
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
      await loadPasskeys();
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
      await loadPasskeys();
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove passkey.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="glass-panel p-6 rounded-2xl border border-border/50 bg-card space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Fingerprint className="size-6 text-primary" />
              Biometric Logins & FIDO2 Passkeys
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Sign into BusinessOS AI instantly using Apple Touch ID, Face ID, Windows Hello, or Android Fingerprint without entering your password.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 ${
              biometricSupported
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
            }`}>
              <ShieldCheck className="size-3.5" />
              {biometricSupported ? "Device Sensor Detected" : "Checking Sensor Support..."}
            </span>
            <button
              onClick={() => loadPasskeys()}
              className="p-1.5 h-8 w-8 border hover:bg-muted rounded-lg text-muted-foreground"
              title="Refresh"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Enrollment Box */}
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/[0.03] space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Sparkles className="size-4 text-primary" />
            <span>Enroll New Biometric Authenticator</span>
          </div>

          <p className="text-xs text-muted-foreground">
            Register this current phone, tablet, or PC as an authorized biometric authenticator. The biometric data never leaves your hardware device.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
            <input
              type="text"
              value={customDeviceName}
              onChange={(e) => setCustomDeviceName(e.target.value)}
              placeholder={`Device Name (e.g. ${getDefaultDeviceName()})`}
              className="h-10 px-3.5 text-xs rounded-xl border bg-background text-foreground flex-1"
            />

            <Button
              onClick={handleEnrollPasskey}
              disabled={enrolling}
              className="gradient-brand text-white font-bold text-xs h-10 px-5 gap-2 shadow-xs cursor-pointer"
            >
              <Fingerprint className="size-4" />
              {enrolling ? "Waiting for sensor scan..." : "Enroll This Device"}
            </Button>
          </div>
        </div>
      </div>

      {/* Enrolled devices list */}
      <div className="glass-panel p-6 rounded-2xl border border-border/50 bg-card space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-border/40">
          <div>
            <h4 className="text-base font-bold text-foreground flex items-center gap-2">
              <Key className="size-4 text-primary" />
              Your Enrolled Biometric Passkeys ({passkeys.length})
            </h4>
            <p className="text-xs text-muted-foreground">Active cryptographic credentials registered to your user profile.</p>
          </div>
        </div>

        {passkeys.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-border/60 space-y-2">
            <Fingerprint className="size-10 text-muted-foreground mx-auto opacity-40" />
            <p className="text-sm font-bold text-foreground">No Biometric Passkeys Enrolled</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Click "Enroll This Device" above to authorize Touch ID, Face ID, or Windows Hello for instant 1-touch sign-ins.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {passkeys.map((pk, i) => (
              <motion.div
                key={pk.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 rounded-xl border border-border/60 bg-muted/20 hover:border-primary/30 transition-all flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                    <Fingerprint className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{pk.device_name}</p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500">
                        Active
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      ID: {pk.credential_id.substring(0, 18)}...
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Enrolled on {format(new Date(pk.created_at), "dd MMM yyyy")}
                      {pk.last_used_at && (
                        <span> · Last used {format(new Date(pk.last_used_at), "dd MMM, h:mm a")}</span>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDeletePasskey(pk)}
                  className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Remove Passkey"
                >
                  <Trash2 className="size-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
