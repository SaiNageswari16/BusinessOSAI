import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { ArrowRightLeft } from "lucide-react";

export function ReturnsRefunds() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Returns & Refunds</h2>
          <p className="text-sm text-muted-foreground">Process customer returns and restore items back to inventory.</p>
        </div>
      </div>

      <Card className="p-12 flex flex-col items-center text-center border-dashed bg-muted/20">
        <ArrowRightLeft className="size-16 text-muted-foreground opacity-20 mb-4" />
        <h3 className="text-xl font-bold mb-2">Scan Receipt Barcode</h3>
        <p className="text-muted-foreground max-w-md">To initiate a return, scan the barcode on the customer's receipt or enter the Receipt ID manually.</p>
        <div className="mt-6 flex gap-2">
          <input className="h-10 px-4 rounded-lg border w-64 text-center font-mono" placeholder="RCP-XXXX-XXXX" />
          <Button className="gradient-brand text-white border-0">Find Receipt</Button>
        </div>
      </Card>
    </div>
  );
}
