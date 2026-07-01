import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { BarChart3, Filter, Download } from "lucide-react";

export function SpendAnalysis() {
  const data = [
    { category: "Electronics", spend: "₹1,45,00,000", pct: 65 },
    { category: "Groceries", spend: "₹45,50,000", pct: 20 },
    { category: "Office Supplies", spend: "₹12,80,000", pct: 8 },
    { category: "Logistics", spend: "₹8,90,000", pct: 7 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Spend Analysis</h2>
          <p className="text-sm text-muted-foreground">Interactive analytics for department and supplier spend.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Filter className="size-4 mr-2" /> Filter</Button>
          <Button variant="outline"><Download className="size-4 mr-2" /> Export</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 md:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg flex items-center gap-2"><BarChart3 className="size-5 text-primary" /> Spend by Category</h3>
          </div>
          <div className="space-y-4">
            {data.map((cat, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{cat.category}</span>
                  <span className="text-sm font-bold font-mono">{cat.spend}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: `${cat.pct}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 bg-primary text-primary-foreground flex flex-col justify-center">
          <div className="text-[10px] uppercase font-bold text-primary-foreground/70 mb-1">Total Procurement Spend (YTD)</div>
          <div className="text-4xl font-bold font-mono tracking-tighter">₹2.12<span className="text-xl ml-1">Cr</span></div>
          <div className="text-sm font-medium mt-2 bg-white/20 w-fit px-2 py-1 rounded text-white">+14% vs Last Year</div>
        </Card>
      </div>
    </div>
  );
}
