import React from "react";
import { motion } from "framer-motion";
import { Star, MessageSquare, TrendingUp, ThumbsUp, Quote } from "lucide-react";
import { useCrmData } from "@/hooks/useCrmData";

interface Props {
  tab?: string;
}

export function Feedback({ tab = "nps" }: Props) {
  const { mockCrmStats } = useCrmData();
  const reviews = [
    { id: 1, customer: "Sarah Jenkins", rating: 5, date: "2 days ago", comment: "Absolutely fantastic service! The team was super helpful with my return.", type: "Support" },
    { id: 2, customer: "David Chen", rating: 4, date: "5 days ago", comment: "Great product quality, but delivery was a day late.", type: "Delivery" },
    { id: 3, customer: "Acme Corp", rating: 5, date: "1 week ago", comment: "Our dedicated account manager has been a game changer for our procurement process.", type: "Sales" },
    { id: 4, customer: "Global Trade LLC", rating: 3, date: "2 weeks ago", comment: "The new bulk ordering interface is a bit confusing compared to the old one.", type: "Product" },
    { id: 5, customer: "TechNova", rating: 5, date: "1 month ago", comment: "Flawless API integration. Saved us hundreds of developer hours.", type: "Product" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Customer Feedback</h1>
        <p className="text-sm text-muted-foreground">Monitor CSAT, NPS, and direct customer reviews.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-xl border border-border/50 text-center flex flex-col justify-center items-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent" />
          <p className="text-sm font-medium text-muted-foreground mb-2 relative z-10">Average Rating</p>
          <div className="flex items-center gap-2 mb-2 relative z-10">
            <h2 className="text-5xl font-bold text-foreground">4.8</h2>
            <div className="flex flex-col items-start gap-1">
              <div className="flex text-amber-500">
                <Star className="size-4" fill="currentColor" />
                <Star className="size-4" fill="currentColor" />
                <Star className="size-4" fill="currentColor" />
                <Star className="size-4" fill="currentColor" />
                <Star className="size-4" fill="currentColor" />
              </div>
              <span className="text-xs text-muted-foreground">Based on 1,240 reviews</span>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-border/50 text-center flex flex-col justify-center items-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent" />
          <p className="text-sm font-medium text-muted-foreground mb-2 relative z-10">Net Promoter Score (NPS)</p>
          <div className="flex items-end gap-3 mb-2 relative z-10">
            <h2 className="text-5xl font-bold text-foreground">72</h2>
            <span className="text-sm font-medium text-emerald-500 mb-1 flex items-center gap-1">
              <TrendingUp className="size-4" /> Excellent
            </span>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-border/50 flex flex-col justify-center gap-3">
          <p className="text-sm font-medium text-muted-foreground mb-1">Sentiment Analysis</p>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Positive (75%)</span>
                <span className="font-medium text-emerald-500">930</span>
              </div>
              <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: '75%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Neutral (18%)</span>
                <span className="font-medium text-blue-500">223</span>
              </div>
              <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: '18%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Negative (7%)</span>
                <span className="font-medium text-red-500">87</span>
              </div>
              <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                <div className="h-full bg-red-500" style={{ width: '7%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {reviews.map((review, i) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={review.id}
            className="glass-panel p-6 rounded-xl border border-border/50"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center font-bold text-primary">
                  {review.customer.charAt(0)}
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">{review.customer}</h4>
                  <p className="text-xs text-muted-foreground">{review.date} • {review.type}</p>
                </div>
              </div>
              <div className="flex gap-0.5 text-amber-500">
                {[...Array(5)].map((_, idx) => (
                  <Star key={idx} className="size-4" fill={idx < review.rating ? "currentColor" : "none"} strokeWidth={idx < review.rating ? 0 : 2} />
                ))}
              </div>
            </div>
            
            <div className="relative">
              <Quote className="absolute -left-2 -top-2 size-6 text-muted-foreground/10 rotate-180" />
              <p className="text-sm text-foreground/90 pl-4 relative z-10 italic">
                "{review.comment}"
              </p>
            </div>
            
            <div className="mt-4 pt-4 border-t border-border/50 flex justify-between items-center">
              <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
                <MessageSquare className="size-3.5" /> Reply
              </button>
              <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-emerald-500 transition-colors">
                <ThumbsUp className="size-3.5" /> Helpful (2)
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
