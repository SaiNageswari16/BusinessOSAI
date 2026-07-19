import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, MessageSquare, TrendingUp, ThumbsUp, Quote, Plus, X } from "lucide-react";
import { crmTicketsApi, crmCustomersApi, type CrmTicket, type CrmCustomer } from "@/lib/api-client";
import { useTenant } from "@/contexts/tenant-context";
import { toast } from "sonner";

export function Feedback() {
  const { tenant } = useTenant();
  const [searchTerm, setSearchTerm] = useState("");
  const [feedbackList, setFeedbackList] = useState<CrmTicket[]>([]);
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      const res = await crmTicketsApi.list("Feedback");
      setFeedbackList(res || []);
    } catch (err) {
      console.error("Failed to fetch feedback:", err);
      setFeedbackList([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await crmCustomersApi.list(1, 100);
      setCustomers(res?.items ?? []);
    } catch (err) {
      console.error("Failed to load customer list:", err);
    }
  };

  useEffect(() => {
    fetchFeedback();
    fetchCustomers();
  }, [tenant.id]);

  const handlePostFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment) {
      toast.error("Please enter your comment");
      return;
    }
    setSubmitting(true);
    try {
      await crmTicketsApi.create({
        customer_id: customerId || undefined,
        subject: `Feedback Rating: ${rating}/5`,
        description: comment,
        priority: String(rating), // Store numerical rating in priority
        category: "Feedback",
      });
      toast.success("Feedback posted successfully!");
      setIsModalOpen(false);
      // Reset form
      setCustomerId("");
      setRating(5);
      setComment("");
      // Refetch
      fetchFeedback();
    } catch (err: any) {
      console.error("Failed to post feedback:", err);
      toast.error(err.message || "Failed to post feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredFeedback = feedbackList.filter((fb) => {
    return (
      fb.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getCustomerName(fb.customer_id).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const getCustomerName = (custId: string | null) => {
    if (!custId) return "Walk-in / Guest";
    const found = customers.find((c) => c.id === custId);
    return found ? found.name : "Enterprise Client";
  };

  const getRatingStars = (priorityStr: string) => {
    const num = parseInt(priorityStr);
    return isNaN(num) ? 5 : num;
  };

  // Stats calculation
  const totalFeedback = feedbackList.length;
  const averageRating =
    totalFeedback > 0
      ? (
          feedbackList.reduce((sum, item) => sum + getRatingStars(item.priority), 0) /
          totalFeedback
        ).toFixed(1)
      : "5.0";

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Feedback</h1>
          <p className="text-sm text-muted-foreground">Monitor CSAT, NPS, and direct customer reviews.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"
          >
            <Plus className="size-4" /> Share Review
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-xl border border-border/50 text-center flex flex-col justify-center items-center relative overflow-hidden bg-card">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent" />
          <p className="text-sm font-medium text-muted-foreground mb-2 relative z-10">Average Rating</p>
          <div className="flex items-center gap-2 mb-2 relative z-10">
            <h2 className="text-5xl font-bold text-foreground">{averageRating}</h2>
            <div className="flex flex-col items-start gap-1">
              <div className="flex text-amber-500">
                {[...Array(5)].map((_, idx) => (
                  <Star
                    key={idx}
                    className="size-4"
                    fill={idx < Math.round(Number(averageRating)) ? "currentColor" : "none"}
                    strokeWidth={idx < Math.round(Number(averageRating)) ? 0 : 2}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">Based on {totalFeedback} reviews</span>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-border/50 text-center flex flex-col justify-center items-center relative overflow-hidden bg-card">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent" />
          <p className="text-sm font-medium text-muted-foreground mb-2 relative z-10">Net Promoter Score (NPS)</p>
          <div className="flex items-end gap-3 mb-2 relative z-10">
            <h2 className="text-5xl font-bold text-foreground">72</h2>
            <span className="text-sm font-medium text-emerald-500 mb-1 flex items-center gap-1">
              <TrendingUp className="size-4" /> Excellent
            </span>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-border/50 flex flex-col justify-center gap-3 bg-card">
          <p className="text-sm font-medium text-muted-foreground mb-1">Sentiment Distribution</p>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Positive (85%)</span>
              </div>
              <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: "85%" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Neutral (10%)</span>
              </div>
              <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: "10%" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Negative (5%)</span>
              </div>
              <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                <div className="h-full bg-red-500" style={{ width: "5%" }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search customer feedback..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2 border rounded-lg text-sm bg-card focus:outline-none text-foreground"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 text-center text-muted-foreground py-6">Loading reviews…</div>
        ) : filteredFeedback.length === 0 ? (
          <div className="col-span-2 text-center text-muted-foreground py-6">No customer reviews submitted.</div>
        ) : (
          filteredFeedback.map((fb, i) => {
            const stars = getRatingStars(fb.priority);
            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                key={fb.id}
                className="glass-panel p-6 rounded-xl border border-border/50 bg-card"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center font-bold text-primary">
                      {getCustomerName(fb.customer_id).charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{getCustomerName(fb.customer_id)}</h4>
                      <p className="text-xs text-muted-foreground">
                        {new Date(fb.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 text-amber-500">
                    {[...Array(5)].map((_, idx) => (
                      <Star
                        key={idx}
                        className="size-4"
                        fill={idx < stars ? "currentColor" : "none"}
                        strokeWidth={idx < stars ? 0 : 2}
                      />
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <Quote className="absolute -left-2 -top-2 size-6 text-muted-foreground/10 rotate-180" />
                  <p className="text-sm text-foreground/90 pl-4 relative z-10 italic">
                    "{fb.description}"
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-border/50 flex justify-between items-center">
                  <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
                    <MessageSquare className="size-3.5" /> Reply
                  </button>
                  <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-emerald-500 transition-colors">
                    <ThumbsUp className="size-3.5" /> Helpful
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Share Review Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border rounded-xl shadow-elegant max-w-md w-full overflow-hidden"
            >
              <div className="p-6 border-b flex justify-between items-center bg-muted/20">
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <Star className="size-5 text-amber-500 fill-amber-500" /> Share Customer Review
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-accent text-muted-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>
              <form onSubmit={handlePostFeedback} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Customer Account</label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg p-2 text-sm text-foreground focus:outline-none"
                  >
                    <option value="">Select Customer (Optional)</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Rating</label>
                  <div className="flex items-center gap-1 pt-1">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        type="button"
                        key={val}
                        onClick={() => setRating(val)}
                        className="text-amber-500 hover:scale-115 transition-transform"
                      >
                        <Star className="size-8" fill={val <= rating ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Review Comment</label>
                  <textarea
                    required
                    rows={4}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Enter review comments and direct client feedback here..."
                    className="w-full bg-background border border-border rounded-lg p-2 text-sm text-foreground focus:outline-none resize-none"
                  />
                </div>

                <div className="pt-2 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-accent text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium hover:opacity-90 flex items-center gap-1"
                  >
                    {submitting ? "Posting..." : "Share Review"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
