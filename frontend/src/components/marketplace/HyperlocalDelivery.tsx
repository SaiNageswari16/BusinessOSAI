import React, { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Zap, Clock, Store, ShieldCheck, Search, Sliders } from "lucide-react";
import { cn } from "@/lib/utils";

interface HyperlocalZone {
  id: string;
  zoneName: string;
  maxRadiusKm: number;
  guaranteedDeliveryTime: string;
  dispatchHubsCount: number;
  expressSurcharge: number;
  status: "Active Zone" | "Offline";
}

export function HyperlocalDelivery() {
  const [zones, setZones] = useState<HyperlocalZone[]>([
    {
      id: "HYP-001",
      zoneName: "Downtown Metro 15-Min Express Zone",
      maxRadiusKm: 5,
      guaranteedDeliveryTime: "30 Mins",
      dispatchHubsCount: 4,
      expressSurcharge: 4.99,
      status: "Active Zone",
    },
    {
      id: "HYP-002",
      zoneName: "Suburban Industrial & Tech Park Zone",
      maxRadiusKm: 12,
      guaranteedDeliveryTime: "60 Mins",
      dispatchHubsCount: 2,
      expressSurcharge: 2.99,
      status: "Active Zone",
    },
  ]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hyperlocal & 30-Min Express Delivery Zones</h1>
          <p className="text-sm text-muted-foreground">Configure instant local delivery geofences, store hub dispatch radiuses, and express surcharges.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {zones.map((z) => (
          <div key={z.id} className="glass-panel p-6 rounded-xl border border-border/50 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1 w-fit">
                  <Zap className="size-3 fill-amber-500" /> {z.guaranteedDeliveryTime} Guarantee
                </span>
                <h3 className="font-bold text-foreground text-lg">{z.zoneName}</h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                {z.status}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs bg-background/50 p-3 rounded-lg border border-border/40 text-center">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">Max Radius</span>
                <p className="font-bold text-foreground font-mono">{z.maxRadiusKm} km</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">Store Hubs</span>
                <p className="font-bold text-primary font-mono">{z.dispatchHubsCount} Hubs</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">Express Fee</span>
                <p className="font-bold text-emerald-500 font-mono">${z.expressSurcharge.toFixed(2)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
