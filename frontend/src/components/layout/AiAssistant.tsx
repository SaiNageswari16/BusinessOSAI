import { useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Canned responses until the AI backend is connected.
const canned: Record<string, string> = {
  sales:
    "Today's sales are ₹1,42,850 across 428 orders — 12.8% above last Wednesday. Dinner (19:00–21:00) contributed 38%.",
  stock:
    "4 items are below par: Chicken (8 kg, ~half a day), Basmati Rice (22 kg), Cooking Oil (14 L) and Paneer (4 kg). I'd raise POs for Chicken and Paneer now.",
  biryani:
    "Chicken Biryani is today's top seller (86 portions). Evening demand is forecast +18%; pre-prep 12 kg rice by 17:30.",
};
const suggestions = [
  "How are sales today?",
  "What stock is running low?",
  "Biryani forecast tonight",
];

export function AiAssistant({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [msgs, setMsgs] = useState<{ role: "user" | "ai"; text: string }[]>([
    {
      role: "ai",
      text: "Hi Ananya — I'm watching Banjara Hills for you. Ask about sales, stock, kitchen or customers.",
    },
  ]);
  const [q, setQ] = useState("");
  const ask = (text: string) => {
    if (!text.trim()) return;
    const t = text.toLowerCase();
    const key =
      t.includes("stock") || t.includes("low")
        ? "stock"
        : t.includes("biryani") || t.includes("forecast")
          ? "biryani"
          : "sales";
    setMsgs((m) => [...m, { role: "user", text }, { role: "ai", text: canned[key] ?? "" }]);
    setQ("");
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <span className="grid size-7 place-items-center rounded-md bg-ai/12 text-ai">
              <Sparkles className="size-4" />
            </span>
            AI Assistant
            <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              Preview
            </span>
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {msgs.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-10 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "mr-10 rounded-lg border bg-surface px-3 py-2 text-sm"
              }
            >
              {m.text}
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t p-4">
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(q);
            }}
            className="flex gap-2"
          >
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ask anything about your restaurant…"
            />
            <Button type="submit" size="icon">
              <Send />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
