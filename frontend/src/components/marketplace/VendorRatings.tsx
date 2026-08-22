import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, MessageSquare, ThumbsUp, ThumbsDown, ShieldAlert, CheckCircle, Search, Filter, Store, User, CornerUpLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { marketplaceApi } from "@/lib/marketplace-api";

interface Review {
  id: string;
  vendorName: string;
  vendorCode: string;
  customerName: string;
  rating: number;
  date: string;
  comment: string;
  productName: string;
  status: "Published" | "Flagged" | "Under Review";
  vendorReply?: string;
  helpfulCount: number;
}

export function VendorRatings() {
  const [searchTerm, setSearchTerm] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [replyModalReview, setReplyModalReview] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState("");

  const [reviews, setReviews] = useState<Review[]>([
    {
      id: "REV-901",
      vendorName: "Apex Tech Solutions",
      vendorCode: "APEX",
      customerName: "David Miller",
      rating: 5,
      date: "2026-08-14",
      comment: "Outstanding product quality and ultra-fast dispatch. Reached within 24 hours of ordering!",
      productName: "Ultra HD Smart LED Monitor 32-Inch",
      status: "Published",
      vendorReply: "Thank you David! We prioritize lightning-fast fulfillment for all orders.",
      helpfulCount: 14,
    },
    {
      id: "REV-902",
      vendorName: "Urban Retail Group",
      vendorCode: "URBN",
      customerName: "Sarah Jenkins",
      rating: 2,
      date: "2026-08-13",
      comment: "Package box was slightly dented on delivery, though the office chair inside was undamaged.",
      productName: "Ergonomic Executive Office Chair",
      status: "Flagged",
      helpfulCount: 3,
    },
    {
      id: "REV-903",
      vendorName: "Nexus Supply Chain",
      vendorCode: "NEXS",
      customerName: "Robert Chen",
      rating: 5,
      date: "2026-08-11",
      comment: "Bulk order of industrial tool sets delivered seamlessly to our warehouse facility.",
      productName: "Precision Industrial Tool Set 120-Piece",
      status: "Published",
      helpfulCount: 8,
    },
    {
      id: "REV-904",
      vendorName: "Global Logistics Hub",
      vendorCode: "GLOG",
      customerName: "Amira Al-Mansoor",
      rating: 4,
      date: "2026-08-10",
      comment: "Good freight service, clear tracking notifications throughout transit.",
      productName: "Freight Cargo Shipping Service",
      status: "Published",
      vendorReply: "Appreciate your feedback Amira! Glad our tracking updates kept you informed.",
      helpfulCount: 5,
    },
  ]);

  const [ratingSummary, setRatingSummary] = useState({
    average: 4.8,
    totalReviews: 1240,
    distribution: [
      { stars: 5, percentage: 72, count: 892 },
      { stars: 4, percentage: 18, count: 223 },
      { stars: 3, percentage: 5, count: 62 },
      { stars: 2, percentage: 3, count: 37 },
      { stars: 1, percentage: 2, count: 26 },
    ],
  });

  useEffect(() => {
    marketplaceApi.getVendorRatings().then(data => {
      if (data.reviews && data.reviews.length > 0) {
        setReviews(data.reviews);
      }
      if (data.summary) {
        setRatingSummary(data.summary);
      }
    }).catch(() => {});
  }, []);

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyModalReview || !replyText.trim()) return;
    setReviews(prev =>
      prev.map(r => r.id === replyModalReview.id ? { ...r, vendorReply: replyText } : r)
    );
    setReplyModalReview(null);
    setReplyText("");
  };

  const toggleStatus = (id: string, newStatus: Review["status"]) => {
    setReviews(prev =>
      prev.map(r => r.id === id ? { ...r, status: newStatus } : r)
    );
  };

  const filteredReviews = reviews.filter(r => {
    const matchesSearch = r.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.comment.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRating = ratingFilter === "all" || r.rating.toString() === ratingFilter;
    const matchesStatus = statusFilter === "all" || r.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesRating && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendor Ratings & Review Management</h1>
          <p className="text-sm text-muted-foreground">Monitor customer feedback, score distribution, and vendor responses across marketplace vendors.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search reviews..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select 
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm font-medium focus:outline-none"
          >
            <option value="all">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>
        </div>
      </div>

      {/* Ratings Summary Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 glass-panel p-6 rounded-xl border border-border/50 flex flex-col justify-center items-center text-center space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overall Marketplace Rating</span>
          <div className="text-5xl font-extrabold text-foreground flex items-center justify-center gap-2">
            {ratingSummary.average}
            <Star className="size-8 fill-amber-400 text-amber-400" />
          </div>
          <p className="text-xs text-muted-foreground">Based on {ratingSummary.totalReviews.toLocaleString()} verified customer purchases</p>
        </div>

        <div className="lg:col-span-8 glass-panel p-6 rounded-xl border border-border/50 space-y-2">
          <h3 className="text-sm font-bold text-foreground mb-3">Rating Breakdown</h3>
          {ratingSummary.distribution.map((d) => (
            <div key={d.stars} className="flex items-center gap-3 text-xs">
              <span className="w-12 font-medium text-foreground flex items-center gap-1">
                {d.stars} <Star className="size-3.5 fill-amber-400 text-amber-400" />
              </span>
              <div className="flex-1 h-2 bg-accent/60 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${d.percentage}%` }} />
              </div>
              <span className="w-12 text-right text-muted-foreground">{d.percentage}%</span>
              <span className="w-16 text-right font-mono text-muted-foreground">({d.count})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Review List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">Customer Reviews & Moderation Log</h2>
        <div className="space-y-3">
          {filteredReviews.map((rev, i) => (
            <motion.div
              key={rev.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="glass-panel p-5 rounded-xl border border-border/50 space-y-3 hover:border-primary/20 transition-all"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-border/40">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                    {rev.customerName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">{rev.customerName}</span>
                      <span className="text-xs text-muted-foreground">• Verified Buyer</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Item: <span className="text-foreground font-medium">{rev.productName}</span></p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, s) => (
                      <Star
                        key={s}
                        className={cn("size-4", s < rev.rating ? "fill-amber-400 text-amber-400" : "text-border")}
                      />
                    ))}
                  </div>
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider",
                    rev.status === "Published" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                    rev.status === "Flagged" ? "bg-red-500/10 text-red-600 border border-red-500/20" :
                    "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                  )}>
                    {rev.status}
                  </span>
                </div>
              </div>

              <p className="text-sm text-foreground leading-relaxed">{rev.comment}</p>

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground pt-2">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1"><Store className="size-3.5 text-primary" /> Vendor: <strong className="text-foreground">{rev.vendorName}</strong></span>
                  <span>Date: {rev.date}</span>
                </div>

                <div className="flex items-center gap-2">
                  {rev.status === "Published" ? (
                    <button 
                      onClick={() => toggleStatus(rev.id, "Flagged")}
                      className="px-2.5 py-1 text-xs text-red-500 hover:bg-red-500/10 rounded-md transition-colors flex items-center gap-1"
                    >
                      <ShieldAlert className="size-3.5" /> Flag Review
                    </button>
                  ) : (
                    <button 
                      onClick={() => toggleStatus(rev.id, "Published")}
                      className="px-2.5 py-1 text-xs text-emerald-600 hover:bg-emerald-500/10 rounded-md transition-colors flex items-center gap-1"
                    >
                      <CheckCircle className="size-3.5" /> Approve & Publish
                    </button>
                  )}
                  <button 
                    onClick={() => { setReplyModalReview(rev); setReplyText(rev.vendorReply || ""); }}
                    className="px-3 py-1 bg-accent hover:bg-accent/80 text-foreground font-medium rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <CornerUpLeft className="size-3.5" /> {rev.vendorReply ? "Edit Reply" : "Vendor Reply"}
                  </button>
                </div>
              </div>

              {rev.vendorReply && (
                <div className="mt-3 p-3 bg-accent/40 border-l-2 border-primary rounded-r-lg text-xs space-y-1">
                  <span className="font-semibold text-primary flex items-center gap-1">
                    <Store className="size-3" /> Official Reply from {rev.vendorName}
                  </span>
                  <p className="text-foreground">{rev.vendorReply}</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Reply Modal */}
      {replyModalReview && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-background border border-border rounded-xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <h3 className="font-bold text-foreground text-lg">Vendor Official Response</h3>
            <p className="text-xs text-muted-foreground">Responding to review by <strong className="text-foreground">{replyModalReview.customerName}</strong> for vendor <strong className="text-primary">{replyModalReview.vendorName}</strong>.</p>
            <form onSubmit={handleSendReply} className="space-y-4">
              <textarea
                rows={4}
                required
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type vendor response to customer feedback..."
                className="w-full p-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setReplyModalReview(null)} className="px-4 py-2 bg-accent hover:bg-accent/80 rounded-lg text-sm font-medium">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">Post Response</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
