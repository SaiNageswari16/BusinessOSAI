import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Barcode, ShieldAlert, MonitorCheck } from "lucide-react";

export function SerialNumbers() {
  const data = [
    { id: 1, serial: "SN-2026-X8911-AB", batch: "B-883", mfgDate: "2026-06-15", expDate: "-", product: "Apple MacBook Pro 16 M3 Max", status: "In Stock", location: "Mumbai Hub", qty: 1 },
    { id: 2, serial: "SN-2026-X8912-AC", batch: "B-883", mfgDate: "2026-06-15", expDate: "-", product: "Apple MacBook Pro 16 M3 Max", status: "Sold", location: "Customer", qty: 1 },
    { id: 3, serial: "SN-SONY-WH5-992", batch: "B-991", mfgDate: "2026-01-10", expDate: "-", product: "Sony WH-1000XM5", status: "In Stock", location: "Delhi Cold Storage", qty: 1 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Serial Numbers</h2>
          <p className="text-sm text-muted-foreground">Trace individual high-value items for warranty and compliance.</p>
        </div>
        <Button variant="outline"><Barcode className="size-4 mr-2" /> Scan Serial</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Product</th>
              <th className="px-6 py-4">Batch Number</th>
              <th className="px-6 py-4">Serial Number</th>
              <th className="px-6 py-4">Mfg Date</th>
              <th className="px-6 py-4">Expiry Date</th>
              <th className="px-6 py-4">Warehouse</th>
              <th className="px-6 py-4">Quantity</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((sn) => (
              <tr key={sn.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-bold">{sn.product}</td>
                <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{sn.batch}</td>
                <td className="px-6 py-4 font-mono font-bold text-primary flex items-center gap-2"><Barcode className="size-4" /> {sn.serial}</td>
                <td className="px-6 py-4 text-xs font-medium">{sn.mfgDate}</td>
                <td className="px-6 py-4 text-xs font-medium">{sn.expDate}</td>
                <td className="px-6 py-4 text-xs font-medium">{sn.location}</td>
                <td className="px-6 py-4 font-bold">{sn.qty}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    sn.status === 'In Stock' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'
                  }`}>
                    {sn.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
