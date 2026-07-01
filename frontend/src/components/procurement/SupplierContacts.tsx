import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Users, Mail, Phone, Building2 } from "lucide-react";

export function SupplierContacts() {
  const data = [
    { id: 1, name: "Rajesh Kumar", role: "Sales Manager", supplier: "Apple India Pvt Ltd", phone: "+91 98765 43210", email: "rajesh@apple.com" },
    { id: 2, name: "Priya Sharma", role: "Accounts Head", supplier: "Samsung Electronics", phone: "+91 99887 76655", email: "priya.s@samsung.com" },
    { id: 3, name: "Amit Patel", role: "Support Contact", supplier: "Tata Consumer Products", phone: "+91 88776 65544", email: "support@tata.com" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Supplier Contacts</h2>
          <p className="text-sm text-muted-foreground">Manage directory of sales, accounts, and support personnel.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Add Contact</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Contact Person</th>
              <th className="px-6 py-4">Supplier</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Phone</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((contact) => (
              <tr key={contact.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold flex items-center gap-2"><Users className="size-4 text-primary" /> {contact.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{contact.role}</div>
                </td>
                <td className="px-6 py-4 font-medium flex items-center gap-2"><Building2 className="size-3 text-muted-foreground" /> {contact.supplier}</td>
                <td className="px-6 py-4 font-mono text-xs"><a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-primary hover:underline"><Mail className="size-3" /> {contact.email}</a></td>
                <td className="px-6 py-4 font-mono text-xs"><a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-primary hover:underline"><Phone className="size-3" /> {contact.phone}</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
