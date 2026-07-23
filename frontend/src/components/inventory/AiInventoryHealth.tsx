import React from "react";
import { Card } from "../ui/card";
import { Sparkles, Activity, ShieldCheck, DollarSign, ArrowDown, ArrowUp, Skull, Zap } from "lucide-react";
import { Button } from "../ui/button";

export function AiInventoryHealth() {
  const kpis = [
    { title: "Inventory Health Score", value: "92/100", icon: <Activity className="size-5 text-indigo-500" />, trend: "+4 from last month" },
    { title: "Stock Accuracy", value: "99.8%", icon: <ShieldCheck className="size-5 text-emerald-500" />, trend: "Consistent" },
    { title: "Inventory Value", value: "$4.2M", icon: <DollarSign className="size-5 text-amber-500" />, trend: "-2% variance" },
    { title: "Overstock Products", value: "14", icon: <ArrowUp className="size-5 text-blue-500" />, trend: "Costing $45k" },
    { title: "Understock Products", value: "8", icon: <ArrowDown className="size-5 text-rose-500" />, trend: "Risking $12k sales" },
    { title: "Dead Stock Value", value: "$8.5k", icon: <Skull className="size-5 text-slate-500" />, trend: "+$400 this week" },
  ];

  const recommendations = [
    {
      id: 1,
      title: "Apple iPhone 16 stock will reach minimum level in 6 days.",
      action: "Recommend purchasing 250 units.",
      confidence: 96,
      priority: "High",
    },
    {
      id: 2,
      title: "Excess inventory of 'Sony WH-1000XM4' in Hyderabad.",
      action: "Move 120 units from Hyderabad Warehouse to Bangalore Warehouse.",
      confidence: 89,
      priority: "Medium",
    },
    {
      id: 3,
      title: "Seasonal demand spike expected for 'Winter Jackets'.",
      action: "Increase safety stock by 15% across northern hubs.",
      confidence: 92,
      priority: "Medium",
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="size-6 text-indigo-600" /> AI Inventory Health
          </h2>
          <p className="text-sm text-muted-foreground">AI-generated inventory insights and proactive recommendations.</p>
        </div>
        <Button variant="outline"><Zap className="size-4 mr-2" /> Recalculate Health</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="p-5 flex items-center gap-4">
            <div className="size-10 rounded-xl bg-muted grid place-items-center shrink-0">
              {kpi.icon}
            </div>
            <div>
              <div className="text-sm font-semibold text-muted-foreground">{kpi.title}</div>
              <div className="flex items-end gap-2 mt-1">
                <span className="text-2xl font-bold">{kpi.value}</span>
                <span className="text-[10px] text-muted-foreground font-medium pb-1">{kpi.trend}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <h3 className="text-lg font-bold mt-8 mb-4 flex items-center gap-2">
        <Sparkles className="size-5 text-indigo-600" /> Proactive AI Recommendations
      </h3>

      <div className="space-y-4">
        {recommendations.map(rec => (
          <Card key={rec.id} className="p-5 border-l-4 border-l-indigo-600 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-slate-900">{rec.title}</h4>
              <p className="text-sm text-slate-600 mt-1">{rec.action}</p>
            </div>
            <div className="flex items-center gap-6 shrink-0">
              <div>
                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Confidence</div>
                <div className="font-bold text-indigo-600 text-lg">{rec.confidence}%</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Priority</div>
                <div className={`font-bold text-sm px-2 py-0.5 rounded ${
                  rec.priority === 'High' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {rec.priority}
                </div>
              </div>
              <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800">
                Execute Action
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
