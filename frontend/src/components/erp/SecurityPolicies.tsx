import React from 'react';
import { Card } from "@/components/ui/card";
import { Key, Clock, Monitor } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

export function PasswordPolicies() {
    const { currency, formatCurrency } = useCurrency();
  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-primary/10 rounded-xl">
          <Key className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-base font-bold">Password Policies</h1>
          <p className="text-muted-foreground text-xs">Enforce password strength, expiration, and rotation for all users.</p>
        </div>
      </div>
      
      <Card className="p-3.5">
        <h3 className="text-sm font-semibold mb-3">Complexity Requirements</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-border/50 text-xs">
            <div>
              <p className="font-medium">Minimum Length</p>
              <p className="text-[10px] text-muted-foreground">Require at least this many characters</p>
            </div>
            <select className="bg-background border border-input rounded-md px-2 py-1 text-xs">
              <option>8 characters</option>
              <option>10 characters</option>
              <option defaultValue="12">12 characters</option>
              <option>14 characters</option>
            </select>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-border/50 text-xs">
            <div>
              <p className="font-medium">Require Uppercase & Lowercase</p>
              <p className="text-[10px] text-muted-foreground">Password must contain both (A-Z, a-z)</p>
            </div>
            <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary" defaultChecked />
          </div>

          <div className="flex justify-between items-center py-2 border-b border-border/50 text-xs">
            <div>
              <p className="font-medium">Require Numbers</p>
              <p className="text-[10px] text-muted-foreground">Password must contain at least one number (0-9)</p>
            </div>
            <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary" defaultChecked />
          </div>

          <div className="flex justify-between items-center py-2 text-xs">
            <div>
              <p className="font-medium">Require Special Characters</p>
              <p className="text-[10px] text-muted-foreground">Password must contain at least one symbol (!@#{currency.symbol}%^&*)</p>
            </div>
            <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary" defaultChecked />
          </div>
        </div>
      </Card>
    </div>
  );
}

import { BiometricPasskeySettings } from "./BiometricPasskeySettings";
import { ShieldCheck, Smartphone, Laptop, Globe, AlertTriangle, CheckCircle2, Lock, Save } from "lucide-react";
import { Button } from "../ui/button";
import { toast } from "sonner";

export function SessionPolicies() {
  const [timeout, setTimeoutVal] = React.useState("8_hours");
  const [concurrentLimit, setConcurrentLimit] = React.useState("3");
  const [forceReauthBiometric, setForceReauthBiometric] = React.useState(true);
  const [rememberMeDays, setRememberMeDays] = React.useState("30");

  const handleSave = () => {
    toast.success("Session security policies updated successfully!");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground">Session Policies</h1>
            <p className="text-muted-foreground text-xs">Manage workspace idle timeouts, concurrent sessions, and lifetime token security.</p>
          </div>
        </div>
        <Button onClick={handleSave} className="gradient-brand text-white text-xs h-9 px-4 gap-1.5 shadow-xs">
          <Save className="size-3.5" /> Save Policies
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <div>
              <p className="text-xs font-bold text-foreground">Inactivity / Idle Timeout</p>
              <p className="text-[11px] text-muted-foreground">Automatically lock screen after periods of user inactivity.</p>
            </div>
            <select
              value={timeout}
              onChange={(e) => setTimeoutVal(e.target.value)}
              className="h-8 px-2.5 text-xs rounded-md border bg-background text-foreground"
            >
              <option value="15_mins">15 Minutes</option>
              <option value="30_mins">30 Minutes</option>
              <option value="1_hour">1 Hour</option>
              <option value="8_hours">8 Hours (End of Shift)</option>
              <option value="24_hours">24 Hours</option>
              <option value="never">No Idle Timeout</option>
            </select>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <div>
              <p className="text-xs font-bold text-foreground">Max Concurrent Active Sessions</p>
              <p className="text-[11px] text-muted-foreground">Limits simultaneous workstation and mobile logins per user account.</p>
            </div>
            <select
              value={concurrentLimit}
              onChange={(e) => setConcurrentLimit(e.target.value)}
              className="h-8 px-2.5 text-xs rounded-md border bg-background text-foreground"
            >
              <option value="1">1 Session (Strict)</option>
              <option value="3">3 Devices</option>
              <option value="5">5 Devices</option>
              <option value="unlimited">Unlimited Devices</option>
            </select>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <div>
              <p className="text-xs font-bold text-foreground">Remember Me Duration</p>
              <p className="text-[11px] text-muted-foreground">Persistent cookie validity when users check "Remember me".</p>
            </div>
            <select
              value={rememberMeDays}
              onChange={(e) => setRememberMeDays(e.target.value)}
              className="h-8 px-2.5 text-xs rounded-md border bg-background text-foreground"
            >
              <option value="7">7 Days</option>
              <option value="14">14 Days</option>
              <option value="30">30 Days (Recommended)</option>
              <option value="90">90 Days</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-xs font-bold text-foreground">Biometric Re-auth on Sensitive Financials</p>
              <p className="text-[11px] text-muted-foreground">Prompt Touch ID/Windows Hello before disbursing payroll or approving large invoices.</p>
            </div>
            <input
              type="checkbox"
              checked={forceReauthBiometric}
              onChange={(e) => setForceReauthBiometric(e.target.checked)}
              className="size-4 rounded border-border text-primary focus:ring-primary"
            />
          </div>
        </Card>

        <Card className="p-4 space-y-3 bg-muted/20">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <Lock className="size-4 text-primary" />
            <span>Active Session Revocation</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Emergency administrative tool to terminate all active employee refresh tokens and force immediate re-authentication across all mobile and web workstations.
          </p>
          <div className="pt-2">
            <Button
              variant="outline"
              onClick={() => toast.success("All other active workspace sessions revoked.")}
              className="text-xs h-8 text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
            >
              <AlertTriangle className="size-3.5 mr-1" /> Terminate All Other Active Sessions
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function DevicePolicies() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <Monitor className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground">Device Policies & Biometric Authenticators</h1>
          <p className="text-muted-foreground text-xs">Manage device trusts, biometric enrollment (Touch ID, Face ID, Windows Hello), and hardware security.</p>
        </div>
      </div>

      {/* Embedded Native WebAuthn FIDO2 Biometrics Management */}
      <BiometricPasskeySettings />
    </div>
  );
}

