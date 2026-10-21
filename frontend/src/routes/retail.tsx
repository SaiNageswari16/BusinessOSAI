import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Barcode,
  CheckCircle2,
  DollarSign,
  Package,
  Plus,
  Receipt,
  ScanLine,
  ShoppingCart,
  Store,
  Tag,
} from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/retail")({
  head: () => ({
    meta: [
      { title: "Retail & Supermarket OS — BusinessOS" },
      { name: "description", content: "Barcode scanning, cash registers, aisle auditing & inventory." },
    ],
  }),
  component: RetailPage,
});

const CHECKOUT_LANES = [
  { id: "lane-1", name: "Counter 1 (Express <10)", cashier: "Sunil K.", queue: 2, todaySales: "₹48,200", status: "Open" },
  { id: "lane-2", name: "Counter 2 (Self Checkout)", cashier: "Automated Kiosk", queue: 1, todaySales: "₹62,100", status: "Open" },
  { id: "lane-3", name: "Counter 3 (Bulk & Cart)", cashier: "Meera D.", queue: 4, todaySales: "₹91,450", status: "Open" },
  { id: "lane-4", name: "Counter 4 (Customer Returns)", cashier: "Aakash T.", queue: 0, todaySales: "₹14,300", status: "Standby" },
];

function RetailPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="BusinessOS · Integrated Industry Vertical"
        title="Retail & Commerce OS"
        description="High-speed barcode scanning, multi-lane checkout terminals, price-drop campaigns, and wholesale stock replenishments."
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
            >
              ← Switch Business Portal
            </Link>
            <Button
              onClick={() => toast.success("Scanner active", { description: "Laser barcode engine ready for SKU scan." })}
              className="h-8 gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <ScanLine className="size-3.5" /> Scan Barcode (EAN-13)
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Store Gross Sales" value="₹2,16,050" delta={14.2} icon={<DollarSign className="text-indigo-600" />} />
        <KpiCard label="Items Sold Today" value="3,840" delta={8.6} icon={<Package className="text-indigo-600" />} />
        <KpiCard label="Checkout Lanes Active" value="3 of 4" delta={0} icon={<Store className="text-indigo-600" />} />
        <KpiCard label="Avg Cart Value" value="₹890" delta={3.4} icon={<ShoppingCart className="text-indigo-600" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Checkout Terminals & POS Registers">
            <div className="divide-y divide-slate-100">
              {CHECKOUT_LANES.map((lane) => (
                <div key={lane.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                      <Barcode className="size-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-slate-900">{lane.name}</div>
                      <div className="text-xs text-slate-500">Cashier: {lane.cashier} · {lane.queue} in queue</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm text-slate-900">{lane.todaySales}</div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {lane.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div>
          <Panel title="Category Turnover Share">
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b">
                <span className="font-medium text-slate-700">Packaged Groceries & Staples</span>
                <span className="font-bold text-slate-900">42%</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b">
                <span className="font-medium text-slate-700">Fresh Produce & Dairy</span>
                <span className="font-bold text-slate-900">28%</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b">
                <span className="font-medium text-slate-700">Beverages & Confectionery</span>
                <span className="font-bold text-slate-900">18%</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="font-medium text-slate-700">Home Care & Hygiene</span>
                <span className="font-bold text-slate-900">12%</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </PageContainer>
  );
}
