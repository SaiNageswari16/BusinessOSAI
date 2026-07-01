import { Card } from "@/components/ui/card";
import { Network, Building2, Store, Users, MapPin } from "lucide-react";

export function OrganizationStructure() {
  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto pb-20">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Organization Structure</h2>
        <p className="text-muted-foreground text-sm mt-1">Visual hierarchy of companies, business units, branches, and departments.</p>
      </div>

      <div className="flex flex-col items-center gap-6">
        {/* Company Node */}
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 flex flex-col items-center w-64 shadow-elegant z-10">
          <div className="size-12 rounded-xl gradient-brand text-white grid place-items-center shadow-sm mb-3">
            <Building2 className="size-6" />
          </div>
          <h3 className="font-bold text-center">BusinessOS Global</h3>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Holding Company</p>
        </Card>

        <div className="h-8 w-px bg-border" />

        {/* Business Units Level */}
        <div className="flex justify-center gap-16 relative">
          <div className="absolute top-0 inset-x-[15%] h-px bg-border" />
          
          <div className="flex flex-col items-center gap-6 relative">
            <div className="h-8 w-px bg-border absolute top-0" />
            <Card className="p-4 mt-8 w-56 flex flex-col items-center border hover:border-primary/50 transition-colors z-10">
              <Network className="size-6 text-blue-500 mb-2" />
              <h4 className="font-semibold text-sm">Retail Group</h4>
              <p className="text-[10px] text-muted-foreground mt-0.5">Business Unit</p>
            </Card>

            <div className="h-8 w-px bg-border" />
            
            {/* Branches Level */}
            <div className="flex justify-center gap-4 relative">
              <div className="absolute top-0 inset-x-8 h-px bg-border" />
              
              <div className="flex flex-col items-center mt-8">
                <div className="h-8 w-px bg-border absolute top-0" />
                <Card className="p-3 w-40 flex flex-col items-center text-center">
                  <MapPin className="size-4 text-emerald-500 mb-1.5" />
                  <span className="text-xs font-semibold">HQ Mumbai</span>
                  <span className="text-[9px] text-muted-foreground mt-0.5">150 Employees</span>
                </Card>
              </div>
              
              <div className="flex flex-col items-center mt-8">
                <div className="h-8 w-px bg-border absolute top-0" />
                <Card className="p-3 w-40 flex flex-col items-center text-center">
                  <MapPin className="size-4 text-emerald-500 mb-1.5" />
                  <span className="text-xs font-semibold">Delhi Branch</span>
                  <span className="text-[9px] text-muted-foreground mt-0.5">85 Employees</span>
                </Card>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-6 relative">
            <div className="h-8 w-px bg-border absolute top-0" />
            <Card className="p-4 mt-8 w-56 flex flex-col items-center border hover:border-primary/50 transition-colors z-10">
              <Network className="size-6 text-purple-500 mb-2" />
              <h4 className="font-semibold text-sm">Manufacturing</h4>
              <p className="text-[10px] text-muted-foreground mt-0.5">Business Unit</p>
            </Card>

            <div className="h-8 w-px bg-border" />
            
            {/* Branches Level */}
            <div className="flex justify-center gap-4 relative">
              <div className="flex flex-col items-center mt-8">
                <div className="h-8 w-px bg-border absolute top-0" />
                <Card className="p-3 w-40 flex flex-col items-center text-center">
                  <Store className="size-4 text-amber-500 mb-1.5" />
                  <span className="text-xs font-semibold">Bengaluru Plant</span>
                  <span className="text-[9px] text-muted-foreground mt-0.5">340 Employees</span>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
