import { motion } from "framer-motion";
import { Construction, Sparkles, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl text-center">
        <div className="mx-auto mb-6 size-20 rounded-3xl gradient-brand grid place-items-center text-white shadow-elegant">
          <Construction className="size-9" />
        </div>
        <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary mb-4">
          <Sparkles className="size-3" /> Module under construction
        </div>
        <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          {description ?? "This module is being designed by our product team. Soon you'll have a beautiful, AI-augmented experience right here — built on the same shell as Dashboard and Copilot."}
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild className="gradient-brand text-white border-0 hover:opacity-90">
            <Link to="/dashboard"><ArrowLeft className="size-4 mr-1.5" /> Back to dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/copilot"><Sparkles className="size-4 mr-1.5" /> Ask AI Copilot</Link>
          </Button>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-3 text-left">
          {["Realtime data", "AI-augmented", "Audit-ready"].map((f) => (
            <div key={f} className="rounded-xl border bg-card p-4">
              <div className="size-7 rounded-md bg-primary/10 text-primary grid place-items-center mb-2">
                <Sparkles className="size-4" />
              </div>
              <div className="text-sm font-semibold">{f}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
