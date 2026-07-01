import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { CalendarX, AlertTriangle, ArrowRight } from "lucide-react";

export function ExpiryManagement() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Expiry Management</h2>
          <p className="text-sm text-muted-foreground">Monitor FMCG, Pharma, and Food products nearing expiration.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 border-t-4 border-t-rose-500">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold text-rose-500">Already Expired</h3>
            <CalendarX className="size-5 text-rose-500" />
          </div>
          <div className="text-3xl font-bold font-mono">142<span className="text-sm text-muted-foreground font-sans ml-2">units</span></div>
          <p className="text-xs text-muted-foreground mt-2">Requires immediate write-off and disposal.</p>
          <Button variant="outline" size="sm" className="w-full mt-4 text-rose-500 border-rose-200 bg-rose-50 hover:bg-rose-100">Review Write-offs</Button>
        </Card>

        <Card className="p-6 border-t-4 border-t-amber-500">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold text-amber-500">Expiring in 30 Days</h3>
            <AlertTriangle className="size-5 text-amber-500" />
          </div>
          <div className="text-3xl font-bold font-mono">850<span className="text-sm text-muted-foreground font-sans ml-2">units</span></div>
          <p className="text-xs text-muted-foreground mt-2">Value at risk: ₹45,200. Recommend applying discount.</p>
          <Button variant="outline" size="sm" className="w-full mt-4 text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100">Apply 30% Discount Rule</Button>
        </Card>

        <Card className="p-6 border-t-4 border-t-blue-500">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold text-blue-500">Expiring in 90 Days</h3>
            <CalendarX className="size-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold font-mono">3,240<span className="text-sm text-muted-foreground font-sans ml-2">units</span></div>
          <p className="text-xs text-muted-foreground mt-2">Normal clearance tracking zone.</p>
          <Button variant="outline" size="sm" className="w-full mt-4 text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100">View Cohort</Button>
        </Card>
      </div>
    </div>
  );
}
