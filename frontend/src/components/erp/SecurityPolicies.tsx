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

export function SessionPolicies() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-primary/10 rounded-xl">
          <Clock className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-base font-bold">Session Policies</h1>
          <p className="text-muted-foreground text-xs">Manage idle timeouts, concurrent sessions, and lifetime.</p>
        </div>
      </div>
      <Card className="p-3.5">
        <div className="text-muted-foreground text-xs">Session management settings will be available here.</div>
      </Card>
    </div>
  );
}

export function DevicePolicies() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-primary/10 rounded-xl">
          <Monitor className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-base font-bold">Device Policies</h1>
          <p className="text-muted-foreground text-xs">Control device trusts, MDM requirements, and IP restrictions.</p>
        </div>
      </div>
      <Card className="p-3.5">
        <div className="text-muted-foreground text-xs">Device management settings will be available here.</div>
      </Card>
    </div>
  );
}
