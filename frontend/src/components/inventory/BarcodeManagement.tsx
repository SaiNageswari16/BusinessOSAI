import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { ScanBarcode, Printer, Download } from "lucide-react";

export function BarcodeManagement() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Barcode Management</h2>
          <p className="text-sm text-muted-foreground">Generate, print, and assign EAN-13 / Code-128 barcodes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Download className="size-4 mr-2" /> Download Batch</Button>
          <Button className="gradient-brand text-white border-0"><Printer className="size-4 mr-2" /> Print Labels</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6 flex flex-col items-center text-center">
            <ScanBarcode className="size-24 text-foreground mb-4" strokeWidth={1} />
            <div className="font-mono font-bold tracking-[0.2em] mb-2">89040439222{i}</div>
            <div className="text-sm font-bold">Tata Sampann Basmati Rice</div>
            <div className="text-xs text-muted-foreground mt-1">Format: EAN-13</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
