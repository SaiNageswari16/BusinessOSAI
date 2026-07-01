import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { ShieldBan, CalendarX, Plus } from "lucide-react";

export function BlacklistedSuppliers() {
  const data = [
    { id: 1, name: "Apex Suppliers Ltd", reason: "Repeated quality failures in packaging material.", date: "2025-11-15", approvedBy: "Rahul Sharma" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Blacklisted Suppliers</h2>
          <p className="text-sm text-muted-foreground">Manage restricted vendors to prevent unauthorized PO generation.</p>
        </div>
        <Button className="bg-rose-500 hover:bg-rose-600 text-white"><ShieldBan className="size-4 mr-2" /> Blacklist Supplier</Button>
      </div>

      <div className="bg-card border border-rose-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-rose-50/50 text-rose-900/60 text-xs uppercase font-bold">
            <tr>
              <th className="px-6 py-4">Supplier Name</th>
              <th className="px-6 py-4">Reason for Blacklist</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Approved By</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rose-100">
            {data.map((b) => (
              <tr key={b.id} className="hover:bg-rose-50/30 transition-colors">
                <td className="px-6 py-4 font-bold flex items-center gap-2"><ShieldBan className="size-4 text-rose-500" /> {b.name}</td>
                <td className="px-6 py-4 text-sm font-medium text-foreground/80">{b.reason}</td>
                <td className="px-6 py-4 font-mono text-xs flex items-center gap-1.5"><CalendarX className="size-3 text-muted-foreground" /> {b.date}</td>
                <td className="px-6 py-4 text-xs font-semibold">{b.approvedBy}</td>
                <td className="px-6 py-4 text-right">
                  <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100">Pardon</Button>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">No blacklisted suppliers.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
