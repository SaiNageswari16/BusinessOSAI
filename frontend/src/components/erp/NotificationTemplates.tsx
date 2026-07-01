import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, Plus, Mail, MessageSquare, Bell, Smartphone } from "lucide-react";

const templates = [
  { id: 1, name: "Invoice Created", type: "Email", module: "Accounting", status: "Active" },
  { id: 2, name: "Employee Joined", type: "WhatsApp", module: "HRMS", status: "Active" },
  { id: 3, name: "Purchase Approved", type: "Push", module: "Procurement", status: "Active" },
  { id: 4, name: "Low Stock Alert", type: "SMS", module: "Inventory", status: "Active" },
];

export function NotificationTemplates() {
  const [search, setSearch] = useState("");

  const getIcon = (type: string) => {
    switch (type) {
      case 'Email': return <Mail className="size-4 text-blue-500" />;
      case 'WhatsApp': return <MessageSquare className="size-4 text-green-500" />;
      case 'Push': return <Bell className="size-4 text-amber-500" />;
      case 'SMS': return <Smartphone className="size-4 text-indigo-500" />;
      default: return <Mail className="size-4" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notification Templates</h2>
          <p className="text-sm text-muted-foreground">Manage templates for Email, SMS, WhatsApp, and Push notifications.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Create Template</Button>
      </div>

      <div className="flex gap-4 items-center mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search templates..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Template Name</th>
              <th className="px-6 py-4">Channel</th>
              <th className="px-6 py-4">Module</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {templates.map((tpl) => (
              <tr key={tpl.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-bold">{tpl.name}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 bg-muted/50 w-fit px-2 py-1 rounded">
                    {getIcon(tpl.type)} <span className="font-medium text-xs">{tpl.type}</span>
                  </div>
                </td>
                <td className="px-6 py-4">{tpl.module}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    {tpl.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="sm">Edit Design</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
