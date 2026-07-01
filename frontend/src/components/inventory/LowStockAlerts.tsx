import { inventoryLowStock } from "../../data/inventory-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { AlertTriangle, TrendingUp, Search, Plus, ShoppingCart } from "lucide-react";

export function LowStockAlerts() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Low Stock Alerts</h2>
          <p className="text-sm text-muted-foreground">AI-driven reorder points to prevent stockouts.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><ShoppingCart className="size-4 mr-2" /> Auto-Generate PO</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {inventoryLowStock.map((alert) => (
          <Card key={alert.id} className={`p-6 border-t-4 ${alert.priority === 'Critical' ? 'border-t-rose-500' : alert.priority === 'High' ? 'border-t-amber-500' : 'border-t-blue-500'}`}>
            <div className="flex justify-between items-start mb-4">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                alert.priority === 'Critical' ? 'bg-rose-500/10 text-rose-600' : alert.priority === 'High' ? 'bg-amber-500/10 text-amber-600' : 'bg-blue-500/10 text-blue-600'
              }`}>
                <AlertTriangle className="size-3" /> {alert.priority} Priority
              </span>
            </div>
            
            <h3 className="font-bold text-lg leading-tight mb-1">{alert.product}</h3>
            <div className="text-xs text-muted-foreground font-mono mb-4">{alert.sku}</div>

            <div className="bg-muted/40 p-3 rounded-lg border border-dashed grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-[10px] text-muted-foreground font-semibold">Current Stock</div>
                <div className="text-lg font-bold text-rose-500">{alert.current}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground font-semibold">Min Reorder Level</div>
                <div className="text-lg font-bold text-foreground">{alert.min}</div>
              </div>
            </div>

            <div className="text-sm mb-4">
              <span className="text-muted-foreground">Supplier:</span> <span className="font-semibold">{alert.supplier}</span>
            </div>
            
            <div className="flex gap-2">
              <Button variant="default" className="flex-1">Order {alert.reorderQty}</Button>
              <Button variant="outline" className="flex-1">Ignore</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
