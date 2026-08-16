import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Clock, Lock, Play, DollarSign, History } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

export function ShiftManagement() {
    const { currency, formatCurrency } = useCurrency();
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Shift Management</h2>
          <p className="text-sm text-slate-500 mt-1">Manage cash registers, opening floats, and end-of-day reports.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-8 flex flex-col items-center justify-center text-center border-emerald-500/20 bg-emerald-500/5">
          <div className="size-20 rounded-full bg-emerald-500/20 text-emerald-600 grid place-items-center mb-6">
            <Play className="size-10 ml-1" />
          </div>
          <h3 className="text-2xl font-bold">Open Register</h3>
          <p className="text-muted-foreground mt-2 mb-6">Start a new shift and declare your opening cash float.</p>
          <Button className="bg-emerald-500 hover:bg-emerald-600 text-white w-full max-w-xs h-12 text-lg">Start Shift</Button>
        </Card>

        <Card className="p-8 flex flex-col items-center justify-center text-center border-rose-500/20 bg-rose-500/5 opacity-50 cursor-not-allowed">
          <div className="size-20 rounded-full bg-rose-500/20 text-rose-600 grid place-items-center mb-6">
            <Lock className="size-10" />
          </div>
          <h3 className="text-2xl font-bold">Close Register</h3>
          <p className="text-muted-foreground mt-2 mb-6">End current shift and generate Z-Report.</p>
          <Button disabled className="w-full max-w-xs h-12 text-lg">Close Shift</Button>
        </Card>
      </div>

      <h3 className="text-xl font-bold mt-8 mb-4 flex items-center gap-2"><History className="size-5" /> Recent Shifts</h3>
      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Shift ID</th>
              <th className="px-6 py-4">Cashier</th>
              <th className="px-6 py-4">Opened At</th>
              <th className="px-6 py-4">Closed At</th>
              <th className="px-6 py-4">Expected Cash</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr className="hover:bg-muted/30 transition-colors">
              <td className="px-6 py-4 font-mono font-bold">SHF-0012</td>
              <td className="px-6 py-4 font-bold">Ravi K.</td>
              <td className="px-6 py-4">Today, 09:00 AM</td>
              <td className="px-6 py-4">Today, 05:00 PM</td>
              <td className="px-6 py-4 font-mono text-emerald-600 font-bold">{currency.symbol}15,450</td>
              <td className="px-6 py-4"><span className="bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-bold">Closed</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
