import { useState } from "react";
import { erpMfaPolicies } from "../../data/erp-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, ShieldCheck, Filter, Plus, Smartphone, Fingerprint, Lock } from "lucide-react";

export function MfaPolicies() {
  const [search, setSearch] = useState("");
  const filtered = erpMfaPolicies.filter(p => p.role.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">MFA Policies</h2>
          <p className="text-sm text-muted-foreground">Configure global authentication rules, timeouts, and device trust.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Add Policy</Button>
      </div>

      <div className="flex gap-4 items-center mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search roles..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {filtered.map((policy) => (
          <Card key={policy.id} className="p-6 border-t-4 border-t-primary">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                  <ShieldCheck className="size-3" /> Target Role
                </div>
                <h3 className="font-bold text-lg text-foreground">{policy.role}</h3>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${policy.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                {policy.status}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-[10px] text-muted-foreground mb-1">Allowed Methods</div>
                <div className="flex items-center gap-2 font-medium text-sm">
                  {policy.methods.includes('Authenticator') && <Smartphone className="size-4 text-primary" />}
                  {policy.methods.includes('Biometric') && <Fingerprint className="size-4 text-primary" />}
                  {policy.methods}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">Session Timeout</div>
                  <div className="font-semibold flex items-center gap-1"><Lock className="size-3" /> {policy.timeout}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">IP Restriction</div>
                  <div className="font-semibold">{policy.restrictIp ? "Enabled" : "Disabled"}</div>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <Button variant="outline" className="w-full">Configure Rules</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
