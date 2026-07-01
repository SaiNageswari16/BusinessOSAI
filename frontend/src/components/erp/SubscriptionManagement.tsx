import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Zap, HardDrive, Users, Sparkles, Server } from "lucide-react";

export function SubscriptionManagement() {
  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Subscription & Licenses</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage your BusinessOS Enterprise plan, modules, and billing.</p>
        </div>
        <Button size="sm" className="h-9 gap-2 gradient-brand text-white border-0"><Zap className="size-4" /> Upgrade Plan</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2 p-6 flex flex-col justify-between bg-gradient-to-br from-primary/5 to-brand-purple/5 border-primary/20">
          <div>
            <div className="flex items-center gap-2 mb-2 text-primary font-bold">
              <Sparkles className="size-5" /> Enterprise Edition
            </div>
            <h3 className="text-3xl font-black mb-1">$4,999<span className="text-sm text-muted-foreground font-medium"> / month</span></h3>
            <p className="text-sm text-muted-foreground">Billed annually. Next billing date: <strong>March 1, 2027</strong></p>
          </div>
          
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-foreground font-medium"><CheckCircle2 className="size-4 text-emerald-500" /> Unlimited Modules</div>
              <div className="flex items-center gap-2 text-sm text-foreground font-medium"><CheckCircle2 className="size-4 text-emerald-500" /> Advanced Antigravity AI</div>
              <div className="flex items-center gap-2 text-sm text-foreground font-medium"><CheckCircle2 className="size-4 text-emerald-500" /> Dedicated Account Manager</div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-foreground font-medium"><CheckCircle2 className="size-4 text-emerald-500" /> Custom API Rate Limits</div>
              <div className="flex items-center gap-2 text-sm text-foreground font-medium"><CheckCircle2 className="size-4 text-emerald-500" /> White-labeling Options</div>
              <div className="flex items-center gap-2 text-sm text-foreground font-medium"><CheckCircle2 className="size-4 text-emerald-500" /> 24/7 Priority Support</div>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <h3 className="font-bold text-lg mb-4">Current Usage</h3>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="flex items-center gap-1.5 text-muted-foreground"><Users className="size-3.5" /> Users</span>
                <span>350 / 500</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full bg-blue-500 w-[70%]" /></div>
            </div>
            
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="flex items-center gap-1.5 text-muted-foreground"><HardDrive className="size-3.5" /> Storage</span>
                <span>8.4 TB / 10 TB</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full bg-amber-500 w-[84%]" /></div>
            </div>
            
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="flex items-center gap-1.5 text-muted-foreground"><Server className="size-3.5" /> API Calls</span>
                <span>12.4M / 20M</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full bg-emerald-500 w-[62%]" /></div>
            </div>
            
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="flex items-center gap-1.5 text-muted-foreground"><Sparkles className="size-3.5" /> AI Credits</span>
                <span>4.1M / 10M</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full bg-purple-500 w-[41%]" /></div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
