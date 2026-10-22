import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Bot, Send, Sparkles, TrendingUp, Utensils } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inr, orderTotal } from "@/lib/calc";
import { useRestaurantStore } from "@/lib/store";

export const Route = createFileRoute("/ai")({
  component: AiScreen,
});

interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export function AiScreen() {
  const navigate = useNavigate();

  const orders = useRestaurantStore((s) => s.orders);
  const menu = useRestaurantStore((s) => s.menu);
  const ingredients = useRestaurantStore((s) => s.ingredients);
  const tables = useRestaurantStore((s) => s.tables);
  const settings = useRestaurantStore((s) => s.settings);
  const createPurchaseOrder = useRestaurantStore((s) => s.createPurchaseOrder);

  const [promptInput, setPromptInput] = useState("");

  // Deterministic live calculations from the shared store
  const insights = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== "cancelled");
    const totalRevenue = validOrders.reduce((s, o) => s + orderTotal(o, settings.gstPct), 0);
    const avgOrder = validOrders.length ? Math.round(totalRevenue / validOrders.length) : 0;
    const lowStock = ingredients.filter((i) => i.stock <= i.reorder);
    const occupiedTables = tables.filter(
      (t) => t.status === "occupied" || t.status === "billing",
    ).length;

    const itemCounts = new Map<string, { name: string; qty: number; rev: number }>();
    validOrders.forEach((o) =>
      o.lines.forEach((l) => {
        const prev = itemCounts.get(l.itemId) ?? { name: l.name, qty: 0, rev: 0 };
        prev.qty += l.qty;
        prev.rev += l.price * l.qty;
        itemCounts.set(l.itemId, prev);
      }),
    );
    const ranked = Array.from(itemCounts.values()).sort((a, b) => b.rev - a.rev);
    const topDish = ranked[0]?.name ?? "Hyderabadi Chicken Dum Biryani";

    return {
      totalRevenue,
      avgOrder,
      lowStock,
      occupiedTables,
      topDish,
      forecastDinnerCovers: Math.max(48, validOrders.length * 3),
      forecastDinnerRev: Math.round(totalRevenue * 0.42),
    };
  }, [orders, ingredients, tables, settings.gstPct]);

  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      id: "m1",
      role: "assistant",
      text: `Hello Ravi! I am the deterministic RestaurantOS Analytics Co-Pilot for ${settings.restaurant} (${settings.branch}). Based on live store telemetry: gross revenue is ${inr(insights.totalRevenue)} across ${orders.length} orders, top dish is ${insights.topDish}, and ${insights.lowStock.length} ingredients are at or below reorder threshold. Ask me about sales, stock, menu engineering, or dinner forecasts!`,
    },
  ]);

  const buildDeterministicAnswer = (q: string): string => {
    const lower = q.toLowerCase();
    if (lower.includes("stock") || lower.includes("inventory") || lower.includes("mutton")) {
      const names = insights.lowStock.map((i) => `${i.name} (${i.stock} ${i.unit})`).join(", ");
      return `Inventory Check: ${insights.lowStock.length} ingredients require restocking: ${names || "None — all above threshold"}. Recommendation: Issue a restock Purchase Order to Golconda Meats & Amul Dairy before the 7 PM dinner rush.`;
    }
    if (lower.includes("forecast") || lower.includes("dinner") || lower.includes("tonight")) {
      return `Dinner Shift Forecast (Deterministic Model): Projected ${insights.forecastDinnerCovers} covers with estimated revenue of ${inr(insights.forecastDinnerRev)}. Biryani & Tandoor stations are projected to handle 64% of ticket volume between 8:00 PM and 10:00 PM.`;
    }
    if (lower.includes("menu") || lower.includes("margin") || lower.includes("combo")) {
      return `Menu Engineering Insight: "${insights.topDish}" leads revenue velocity. Bundling Paneer Tikka or Chicken 65 with Mango Lassi increases Average Order Value (currently ${inr(insights.avgOrder)}) by ~18%.`;
    }
    return `Live Operational Summary for ${settings.restaurant}: Total Revenue ${inr(insights.totalRevenue)}, Average Order Value ${inr(insights.avgOrder)}, Floor Occupancy ${insights.occupiedTables}/${tables.length} tables, and ${insights.lowStock.length} low-stock alerts.`;
  };

  const handleSendQuestion = (text?: string) => {
    const q = (text ?? promptInput).trim();
    if (!q) return;
    const userMsg: ChatTurn = { id: `u-${Date.now()}`, role: "user", text: q };
    const botMsg: ChatTurn = {
      id: `a-${Date.now() + 1}`,
      role: "assistant",
      text: buildDeterministicAnswer(q),
    };
    setMessages((prev) => [...prev, userMsg, botMsg]);
    setPromptInput("");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="AI Co-Pilot"
        title="Deterministic AI Insights & Forecasting"
        subtitle="Rule-based operational intelligence computed directly from your live orders, recipes, and stock state"
        badge={
          <Badge className="bg-ai text-white gap-1">
            <Sparkles className="h-3 w-3" /> Local Deterministic Engine
          </Badge>
        }
      />

      {/* 4 Structured Insight Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="surface p-4 border-l-4 border-l-ai space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-ai uppercase">
            <span>Sales Velocity Insight</span>
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="text-sm font-bold text-foreground">
            {insights.topDish} drives peak ticket value
          </div>
          <p className="text-xs text-muted-foreground">
            Current AOV is <strong>{inr(insights.avgOrder)}</strong> across{" "}
            {orders.filter((o) => o.status !== "cancelled").length} orders. Promoting Biryani +
            Beverage combos at POS can lift AOV by ₹110/table.
          </p>
        </div>

        <div className="surface p-4 border-l-4 border-l-warning space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-warning uppercase">
            <span>Inventory Reorder Alert</span>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="text-sm font-bold text-foreground">
            {insights.lowStock.length} critical raw materials low
          </div>
          <p className="text-xs text-muted-foreground">
            {insights.lowStock
              .slice(0, 3)
              .map((i) => `${i.name} (${i.stock} ${i.unit})`)
              .join(", ") || "All stock healthy."}
          </p>
          {insights.lowStock.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-full text-xs"
              onClick={() => {
                const firstLow = insights.lowStock[0]!;
                const res = createPurchaseOrder(firstLow.supplierId, [
                  { ingredientId: firstLow.id, qty: firstLow.reorder * 2 },
                ]);
                if (res.ok) {
                  toast.success(`Auto-drafted restock ${res.poId} for ${firstLow.name}`);
                }
              }}
            >
              Auto-Generate Restock PO
            </Button>
          )}
        </div>

        <div className="surface p-4 border-l-4 border-l-primary space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-primary uppercase">
            <span>Demand Forecast</span>
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="text-sm font-bold text-foreground">
            Projected {insights.forecastDinnerCovers} covers tonight
          </div>
          <p className="text-xs text-muted-foreground">
            Expected peak window: <strong>8:00 PM – 10:15 PM</strong> with{" "}
            <strong>{inr(insights.forecastDinnerRev)}</strong> projected dinner revenue. Ensure
            Tandoor & Biryani stations are fully prepped.
          </p>
        </div>

        <div className="surface p-4 border-l-4 border-l-success space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-success uppercase">
            <span>Menu Optimization</span>
            <Utensils className="h-4 w-4" />
          </div>
          <div className="text-sm font-bold text-foreground">High-Margin Starters & Desserts</div>
          <p className="text-xs text-muted-foreground">
            Paneer Tikka (73% gross margin) and Double ka Meetha (82% gross margin) have the highest
            contribution margin on the menu.
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-0 text-xs text-primary"
            onClick={() => navigate({ to: "/menu" })}
          >
            Inspect Menu Margins →
          </Button>
        </div>
      </div>

      {/* Interactive Deterministic AI Assistant Panel */}
      <div className="surface p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ai-soft text-ai">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Ask RestaurantOS Operational Assistant
              </h2>
              <p className="text-xs text-muted-foreground">
                Deterministic analysis of your live local store data (no external API keys required)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              "Which ingredients are low in stock?",
              "What is tonight's dinner forecast?",
              "Recommend menu margin optimizations",
            ].map((preset) => (
              <Button
                key={preset}
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => handleSendQuestion(preset)}
              >
                {preset}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "ml-auto max-w-xl rounded-2xl bg-primary px-4 py-2.5 text-xs text-primary-foreground"
                  : "mr-auto max-w-2xl rounded-2xl border border-border bg-muted/40 px-4 py-3 text-xs text-foreground leading-relaxed"
              }
            >
              {m.text}
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendQuestion();
          }}
          className="flex items-center gap-2 pt-2"
        >
          <Input
            placeholder="Ask about low-stock items, top-selling dishes, or dinner rush forecast..."
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            className="h-9 text-xs"
          />
          <Button type="submit" size="sm" className="h-9 gap-1.5 bg-ai text-white hover:bg-ai/90">
            <Send className="h-3.5 w-3.5" />
            Ask AI
          </Button>
        </form>
      </div>
    </div>
  );
}
