import { inventoryForecast } from "../../data/inventory-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { BrainCircuit, LineChart, Sparkles } from "lucide-react";

export function InventoryForecast() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Inventory Forecast</h2>
          <p className="text-sm text-muted-foreground">Predictive demand analysis powered by Antigravity AI.</p>
        </div>
        <Button variant="outline"><LineChart className="size-4 mr-2" /> View Charts</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {inventoryForecast.map((fc, i) => (
          <Card key={i} className="p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10 transition-transform group-hover:scale-150" />
            
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <BrainCircuit className="size-5" />
                </div>
                <h3 className="font-bold text-lg">{fc.product}</h3>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Current Stock</div>
                <div className="text-xl font-bold font-mono">{fc.currentStock}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Predicted Demand</div>
                <div className="text-xl font-bold font-mono text-primary">{fc.predictedDemand}</div>
              </div>
            </div>

            <div className="bg-indigo-50 border-l-4 border-l-indigo-600 rounded-r-lg p-3 mb-4">
              <div className="text-[10px] uppercase tracking-wider font-bold text-indigo-700 flex items-center gap-1.5 mb-1"><Sparkles className="size-3" /> AI Suggestion</div>
              <div className="text-sm font-medium text-slate-800">{fc.suggestion}</div>
            </div>
            
            <div className="flex justify-between items-center text-xs text-muted-foreground font-medium">
              <span>Seasonality: {fc.seasonality}</span>
              <span>{fc.confidence}% Confidence</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
