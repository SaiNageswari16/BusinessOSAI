import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Award, Gift, Mail, Phone, Plus, Search, Sparkles, UserPlus } from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/PageHeader";
import { StatusBadge, type Tone } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addCustomer, awardPoints, useCustomers } from "@/services/orderService";
import { money } from "@/lib/format";
import type { Customer } from "@/lib/types";

export const Route = createFileRoute("/crm")({
  head: () => ({
    meta: [
      { title: "Customers & Loyalty — RestaurantOS" },
      {
        name: "description",
        content: "Customer profiles, visit history, spend and loyalty tiers.",
      },
      { property: "og:title", content: "Customers & Loyalty — RestaurantOS" },
      {
        property: "og:description",
        content: "Customer profiles, visit history, spend and loyalty tiers.",
      },
    ],
  }),
  component: Crm,
});

const tierTone: Record<Customer["tier"], Tone> = {
  Bronze: "neutral",
  Silver: "info",
  Gold: "warning",
  Platinum: "ai",
};

function Crm() {
  const list = useCustomers();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Customer | null>(null);
  const [adding, setAdding] = useState(false);
  const [d, setD] = useState({ name: "", phone: "", email: "" });

  const activeCustomer = sel ? (list.find((c) => c.id === sel.id) ?? sel) : null;

  const rows = list.filter((c) =>
    `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="CRM & Loyalty Management"
        title="Customers"
        description={`${list.length} profiles · Shared with POS and Billing`}
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4 mr-1.5" /> Add customer
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Repeat customer rate" value="64%" delta={4.1} />
        <KpiCard
          label="Avg lifetime value"
          value={money(Math.round(list.reduce((s, c) => s + c.spend, 0) / (list.length || 1)))}
        />
        <KpiCard
          label="Points outstanding"
          value={list.reduce((s, c) => s + c.points, 0).toLocaleString("en-IN")}
        />
        <KpiCard
          label="Active VIP members"
          value={String(list.filter((c) => c.tier === "Gold" || c.tier === "Platinum").length)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Panel bodyClass="p-0">
          <div className="border-b p-3">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone or email..."
              className="h-8 max-w-sm text-xs"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="font-medium">Phone</th>
                  <th className="text-right font-medium">Visits</th>
                  <th className="text-right font-medium">Lifetime spend</th>
                  <th className="pl-4 font-medium">Last visit</th>
                  <th className="px-4 font-medium">Tier</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSel(c)}
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.email}</div>
                    </td>
                    <td className="font-mono text-xs tabular text-muted-foreground">{c.phone}</td>
                    <td className="text-right font-mono text-xs tabular">{c.visits}</td>
                    <td className="text-right font-medium tabular">{money(c.spend)}</td>
                    <td className="pl-4 text-xs text-muted-foreground">{c.lastVisit}</td>
                    <td className="px-4">
                      <StatusBadge status={c.tier} tone={tierTone[c.tier]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title={activeCustomer ? activeCustomer.name : "Customer Profile"}>
          {activeCustomer ? (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-1.5">
                {activeCustomer.tags.map((t) => (
                  <StatusBadge key={t} status={t} tone="neutral" />
                ))}
              </div>
              <dl className="grid grid-cols-2 gap-3">
                {[
                  ["Visits", activeCustomer.visits],
                  ["Total Spend", money(activeCustomer.spend)],
                  ["Loyalty Points", activeCustomer.points],
                  ["Favourite Dish", activeCustomer.favourite],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-md bg-surface p-2">
                    <dt className="text-[11px] text-muted-foreground">{k}</dt>
                    <dd className="font-semibold text-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    toast.success(`Personalized promo SMS sent to ${activeCustomer.name}`)
                  }
                >
                  <Mail className="size-3.5 mr-1" /> Send offer
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    awardPoints(activeCustomer.id, 100);
                    toast.success(`100 bonus loyalty points awarded to ${activeCustomer.name}`);
                  }}
                >
                  <Award className="size-3.5 mr-1" /> +100 Points
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a customer from the table to view their dining history, lifetime spend, and
              loyalty tier.
            </p>
          )}
        </Panel>
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input
                value={d.name}
                onChange={(e) => setD({ ...d, name: e.target.value })}
                placeholder="e.g. Ramesh Patel"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone Number</Label>
              <Input
                value={d.phone}
                onChange={(e) => setD({ ...d, phone: e.target.value })}
                placeholder="+91 98480 00000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input
                type="email"
                value={d.email}
                onChange={(e) => setD({ ...d, email: e.target.value })}
                placeholder="ramesh@gmail.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!d.name || !d.phone) return toast.error("Name and phone number required");
                const newC = addCustomer({
                  name: d.name,
                  phone: d.phone,
                  email: d.email || "guest@sunrise.in",
                  tags: ["Regular"],
                });
                setD({ name: "", phone: "", email: "" });
                setAdding(false);
                setSel(newC);
                toast.success(`${newC.name} registered and synchronized with POS`);
              }}
            >
              Save Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
