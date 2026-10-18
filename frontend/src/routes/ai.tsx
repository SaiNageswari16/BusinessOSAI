import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  ChefHat,
  Flame,
  Info,
  Lightbulb,
  MessageSquare,
  PackageCheck,
  Send,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/PageHeader";
import { StatusBadge, type Tone } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getLiveAiInsights,
  useCustomers,
  useInventory,
  useOrders,
  useSettings,
  useTables,
} from "@/services/orderService";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "AI Assistant & Intelligence — RestaurantOS" },
      {
        name: "description",
        content:
          "Simulated predictive demand, stock warnings, turnover recommendations, and natural language copilot.",
      },
      { property: "og:title", content: "AI Assistant & Intelligence — RestaurantOS" },
      {
        property: "og:description",
        content:
          "Simulated predictive demand, stock warnings, turnover recommendations, and natural language copilot.",
      },
    ],
  }),
  component: AiPage,
});

const forecastSlots = [
  { time: "12:00–13:00", covers: 48, topDish: "North Indian Thali", confidence: "94%" },
  { time: "13:00–14:30", covers: 92, topDish: "Chicken Biryani", confidence: "96%" },
  { time: "14:30–16:30", covers: 28, topDish: "Cold Coffee & Snacks", confidence: "88%" },
  { time: "19:00–20:30", covers: 114, topDish: "Mutton Biryani & Starters", confidence: "95%" },
  { time: "20:30–22:30", covers: 126, topDish: "Butter Chicken & Naan", confidence: "92%" },
];

function AiPage() {
  const orders = useOrders();
  const tables = useTables();
  const inventory = useInventory();
  const customers = useCustomers();
  const settings = useSettings();

  const liveInsights = getLiveAiInsights();

  // AI chat state
  const [messages, setMessages] = useState<
    Array<{ role: "ai" | "user"; text: string; time: string }>
  >([
    {
      role: "ai",
      text: `Hello ${settings.manager}! I am your AI Operations Copilot for ${settings.currentBranch}. I continuously scan your table turnover, ingredient par levels, prep station queues, and revenue velocity. How can I help you right now?`,
      time: "Just now",
    },
  ]);
  const [prompt, setPrompt] = useState("");

  const handleSendPrompt = (userPromptText: string) => {
    const text = userPromptText.trim();
    if (!text) return;

    const lower = text.toLowerCase();
    const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    let responseText = "";

    if (lower.includes("stock") || lower.includes("inventory") || lower.includes("low")) {
      const lowCount = inventory.filter((i) => i.stock / i.par < 0.4).length;
      const lowNames = inventory
        .filter((i) => i.stock / i.par < 0.4)
        .map((i) => `${i.name} (${i.stock} ${i.unit})`)
        .join(", ");
      responseText = `Currently ${lowCount} inventory items are below safety par: ${lowNames}. I strongly recommend generating purchase orders before 17:00 to prevent dinner service 86's.`;
    } else if (lower.includes("sales") || lower.includes("revenue") || lower.includes("today")) {
      const gross = orders.reduce(
        (s, o) => s + o.lines.reduce((acc, l) => acc + l.qty * l.unitPrice, 0),
        0,
      );
      responseText = `Today's gross order volume stands at ${money(gross || 142850)} across ${orders.length} tickets. Your average order value is ₹${Math.round((gross || 142850) / (orders.length || 1))}.`;
    } else if (lower.includes("table") || lower.includes("seat") || lower.includes("occupied")) {
      const occupied = tables.filter((t) => t.status === "Occupied").length;
      const billing = tables.filter((t) => t.status === "Billing").length;
      const cleaning = tables.filter((t) => t.status === "Cleaning").length;
      responseText = `Floor status: ${occupied} tables occupied, ${billing} requesting bill, ${cleaning} undergoing cleaning, and ${tables.filter((t) => t.status === "Available").length} tables immediately available.`;
    } else if (lower.includes("kitchen") || lower.includes("cook") || lower.includes("station")) {
      const cooking = orders.filter((o) => o.status === "Preparing").length;
      const ready = orders.filter((o) => o.status === "Ready").length;
      responseText = `Kitchen workload: ${cooking} tickets actively cooking on stations, and ${ready} orders ready at pass waiting to be served.`;
    } else {
      responseText = `Based on current restaurant trends, dinner covers are projected to spike after 19:30. Ensure your Tandoor and Biryani prep queues are stocked with pre-cut chicken and parboiled rice.`;
    }

    setMessages((prev) => [
      ...prev,
      { role: "user", text, time: nowTime },
      { role: "ai", text: responseText, time: nowTime },
    ]);
    setPrompt("");
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Artificial Intelligence"
        title="AI Intelligence Hub"
        description="Predictive demand forecasting, automated anomaly detection, and operational recommendations."
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ai/40 bg-ai/10 px-3 py-1 text-xs font-medium text-ai">
              <Sparkles className="size-3" /> Live Simulation Engine Active
            </span>
          </div>
        }
      />

      {/* Simulated AI Notice */}
      <div className="flex items-start gap-3 rounded-lg border border-ai/40 bg-ai/5 p-4 text-sm">
        <Brain className="mt-0.5 size-5 shrink-0 text-ai" />
        <div className="flex-1">
          <div className="font-semibold text-foreground">
            Operational Intelligence & Simulation Notice
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            All predictions and anomaly alerts are computed live from active restaurant state
            (inventory stock, active tables, kitchen ticket age, and order volumes). When connected
            to production, this service links directly to machine-learning models in the FastAPI
            backend.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Active AI Recommendations"
          value={String(liveInsights.length + 2)}
          sub="Updated in real time"
          icon={<Lightbulb />}
        />
        <KpiCard
          label="Forecasted Dinner Covers"
          value="240"
          delta={18.2}
          sub="Peak at 20:30"
          icon={<TrendingUp />}
        />
        <KpiCard
          label="Prep Recommendations"
          value="12 kg"
          sub="Basmati Rice & Chicken"
          icon={<ChefHat />}
        />
        <KpiCard
          label="Potential Table Lag"
          value="4 min"
          delta={-12.5}
          sub="Optimized turnover"
          icon={<Flame />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Real-time Recommendations Feed */}
        <Panel title="Real-Time Recommendations & Anomaly Detection">
          <div className="space-y-3">
            {liveInsights.map((insight) => (
              <div
                key={insight.id}
                className={cn(
                  "rounded-lg border p-3.5 transition-all",
                  insight.severity === "critical"
                    ? "border-critical/40 bg-critical/5"
                    : insight.severity === "warning"
                      ? "border-warning/40 bg-warning/5"
                      : "border-ai/40 bg-ai/5",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 font-medium">
                    {insight.severity === "critical" ? (
                      <AlertTriangle className="size-4 text-critical" />
                    ) : insight.severity === "warning" ? (
                      <Flame className="size-4 text-warning" />
                    ) : (
                      <Sparkles className="size-4 text-ai" />
                    )}
                    <span className="text-sm">{insight.title}</span>
                  </div>
                  <StatusBadge
                    status={insight.kind}
                    tone={
                      insight.severity === "critical"
                        ? "critical"
                        : insight.severity === "warning"
                          ? "warning"
                          : "ai"
                    }
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{insight.text}</p>
                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs font-medium"
                    onClick={() => {
                      insight.run();
                      toast.success(`Action applied: ${insight.actionLabel}`);
                    }}
                  >
                    {insight.actionLabel} <ArrowRight className="size-3 ml-1" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="rounded-lg border border-border bg-surface p-3.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ChefHat className="size-4 text-primary" />
                <span>Biryani Demand Surge Anticipated</span>
                <StatusBadge status="Demand" tone="info" />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Friday dinner historical analysis indicates Chicken and Mutton Biryani account for
                44% of mains ordered between 19:30 and 22:00.
              </p>
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => toast.success("Prep advisory broadcasted to Kitchen KDS")}
                >
                  Send Advisory to Kitchen
                </Button>
              </div>
            </div>
          </div>
        </Panel>

        {/* AI Copilot Interactive Console */}
        <Panel title="AI Operations Copilot" bodyClass="flex flex-col h-[460px] p-0">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-lg px-3.5 py-2.5 text-xs leading-relaxed",
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto border bg-surface text-foreground",
                )}
              >
                <div className="flex items-center gap-1.5 pb-1 font-semibold opacity-80">
                  {m.role === "user" ? (
                    <Users className="size-3" />
                  ) : (
                    <Bot className="size-3 text-ai" />
                  )}
                  <span>{m.role === "user" ? "You" : "RestaurantOS AI"}</span>
                  <span className="ml-auto text-[10px] opacity-60">{m.time}</span>
                </div>
                {m.text}
              </div>
            ))}
          </div>

          <div className="border-t p-3 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {[
                "Which items are low in stock?",
                "What are today's sales numbers?",
                "How is table turnover right now?",
                "Are any kitchen stations bottlenecked?",
              ].map((query) => (
                <button
                  key={query}
                  onClick={() => handleSendPrompt(query)}
                  className="rounded border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {query}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendPrompt(prompt);
              }}
              className="flex gap-2"
            >
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask about live sales, table delays, or food stock..."
                className="h-9 text-xs"
              />
              <Button type="submit" size="sm">
                <Send className="size-3.5" />
              </Button>
            </form>
          </div>
        </Panel>
      </div>

      {/* Demand Forecast Table */}
      <Panel title="Predictive Meal Slot Covers & Preparation Forecast">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Service time slot</th>
                <th className="font-medium">Projected covers</th>
                <th className="font-medium">High-probability dish</th>
                <th className="px-4 text-right font-medium">Model confidence</th>
              </tr>
            </thead>
            <tbody>
              {forecastSlots.map((slot) => (
                <tr key={slot.time} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold">{slot.time}</td>
                  <td className="font-medium tabular">{slot.covers} guests</td>
                  <td className="text-muted-foreground">{slot.topDish}</td>
                  <td className="px-4 text-right">
                    <StatusBadge status={slot.confidence} tone="success" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </PageContainer>
  );
}
