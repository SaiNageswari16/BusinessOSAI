import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Sparkles, TrendingDown, ArrowRight } from "lucide-react";

export function AIPurchaseSuggestions() {
  const data = [
    { id: 1, insight: "Tata Sampann Rice stock will run out in 6 days.", recommendation: "Generate PO for 2,000 units.", supplier: "Tata Consumer", impact: "High Risk" },
    { id: 2, insight: "Samsung Electronics offers 12% lower pricing this week.", recommendation: "Bulk purchase 500 units.", supplier: "Samsung", impact: "Cost Saving" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Purchase Suggestions</h2>
          <p className="text-sm text-muted-foreground">Antigravity AI recommendations for smart procurement.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {data.map((ai) => (
          <Card key={ai.id} className="p-6 relative overflow-hidden group border-primary/20 bg-primary/5">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary text-primary-foreground grid place-items-center">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{ai.insight}</h3>
                  <div className="text-xs font-semibold text-primary mt-0.5">{ai.impact}</div>
                </div>
              </div>
            </div>

            <div className="bg-background p-4 rounded-xl border flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">AI Recommendation</div>
                <div className="font-bold text-sm">{ai.recommendation}</div>
              </div>
              <Button className="gradient-brand text-white border-0">Execute Action <ArrowRight className="size-4 ml-2" /></Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
