import { Card } from "../ui/card";
import { LineChart, Trophy, ShieldCheck, Clock } from "lucide-react";

export function VendorAnalytics() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Vendor Analytics</h2>
          <p className="text-sm text-muted-foreground">Identify top performing suppliers and risk factors.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 flex flex-col items-center text-center border-t-4 border-t-amber-500">
          <div className="size-16 rounded-full bg-amber-500/10 text-amber-600 grid place-items-center mb-4"><Trophy className="size-8" /></div>
          <h3 className="font-bold text-lg">Highest Spend</h3>
          <p className="text-sm text-muted-foreground mt-2">Apple India Pvt Ltd</p>
          <div className="text-xl font-bold font-mono mt-1">₹1.8Cr</div>
        </Card>

        <Card className="p-6 flex flex-col items-center text-center border-t-4 border-t-emerald-500">
          <div className="size-16 rounded-full bg-emerald-500/10 text-emerald-600 grid place-items-center mb-4"><ShieldCheck className="size-8" /></div>
          <h3 className="font-bold text-lg">Most Reliable</h3>
          <p className="text-sm text-muted-foreground mt-2">Tata Consumer Products</p>
          <div className="text-sm font-bold mt-1">99.8% Quality Score</div>
        </Card>

        <Card className="p-6 flex flex-col items-center text-center border-t-4 border-t-blue-500">
          <div className="size-16 rounded-full bg-blue-500/10 text-blue-600 grid place-items-center mb-4"><Clock className="size-8" /></div>
          <h3 className="font-bold text-lg">Fastest Delivery</h3>
          <p className="text-sm text-muted-foreground mt-2">BlueDart Express</p>
          <div className="text-sm font-bold mt-1">Avg 1.2 Days</div>
        </Card>
      </div>
    </div>
  );
}
