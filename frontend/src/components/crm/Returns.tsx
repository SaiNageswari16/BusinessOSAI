import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Filter, RotateCcw, Box, User, ArrowRightLeft, Clock, DollarSign, X } from "lucide-react";
import { crmTicketsApi, crmCustomersApi, type CrmTicket, type CrmCustomer } from "@/lib/api-client";
import { useTenant } from "@/contexts/tenant-context";
import { toast } from "sonner";

export function Returns() {
  const { tenant } = useTenant();
  const [searchTerm, setSearchTerm] = useState("");
  const [returns, setReturns] = useState<CrmTicket[]>([]);
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [submitting, setSubmitting] = useState(false);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const res = await crmTicketsApi.list("Return");
      setReturns(res || []);
    } catch (err) {
      console.error("Failed to fetch returns:", err);
      setReturns([]);
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
    fetchReturns();
    fetchCustomers();
  }, [tenant.id]);

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !description) {
      toast.error("Please enter a subject and description");
      return;
    }
    setSubmitting(true);
    try {
      await crmTicketsApi.create({
        customer_id: customerId || undefined,
        subject,
        description,
        priority,
        category: "Return",
      });
      toast.success("Return authorization created successfully!");
      setIsModalOpen(false);
      // Reset form
      setCustomerId("");
      setSubject("");
      setDescription("");
      setPriority("Medium");
      // Refetch
      fetchReturns();
    } catch (err: any) {
      console.error("Failed to create return authorization:", err);
      toast.error(err.message || "Failed to create return authorization");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredReturns = returns.filter((ret) => {
    return (
      ret.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ret.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const getCustomerName = (custId: string | null) => {
    if (!custId) return "Walk-in / Guest";
    const found = customers.find((c) => c.id === custId);
    return found ? found.name : "Enterprise Client";
  };

  // Stats
  const pendingCount = returns.filter((r) => r.status === "Open" || r.status === "In Progress").length;
  const processedCount = returns.filter((r) => r.status === "Resolved" || r.status === "Closed").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Returns & Refunds</h1>
          <p className="text-sm text-muted-foreground">Manage product returns, RMAs, and refund processing.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"
          >
            <Plus className="size-4" /> Create Return
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Pending Returns", value: pendingCount, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Processed Returns", value: processedCount, icon: RotateCcw, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Total Submissions", value: returns.length, icon: ArrowRightLeft, color: "text-purple-500", bg: "bg-purple-500/10" },
          { label: "Direct Exchange Rate", value: "1.2%", icon: Box, color: "text-emerald-500", bg: "bg-emerald-500/10" },
        ].map((stat, i) => (
          <div key={i} className="glass-panel p-5 rounded-xl border border-border/50 flex items-center gap-4 bg-card">
            <div className={`p-3 rounded-xl ${stat.bg}`}>
              <stat.icon className={`size-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <h3 className="text-xl font-bold text-foreground">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden bg-card">
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by RMA ID or Subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-background/50 border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
            <Filter className="size-4" /> Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border/50">
              <tr>
                <th className="px-6 py-4">RMA ID</th>
                <th className="px-6 py-4">Order Details & Subject</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Date Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">Loading returns…</td>
                </tr>
              ) : filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">No return authorizations logged.</td>
                </tr>
              ) : (
                filteredReturns.map((ret, i) => (
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={ret.id}
                    className="hover:bg-muted/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-foreground flex items-center gap-2">
                        <RotateCcw className="size-4 text-primary" /> {ret.id.slice(0, 8)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">{ret.subject}</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm truncate">{ret.description}</p>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <div className="flex items-center gap-1.5"><User className="size-3.5" /> {getCustomerName(ret.customer_id)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                          ret.status === "Open"
                            ? "bg-amber-500/10 text-amber-600"
                            : ret.status === "In Progress"
                              ? "bg-blue-500/10 text-blue-600"
                              : ret.status === "Resolved"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-red-500/10 text-red-600"
                        }`}
                      >
                        {ret.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-muted-foreground font-mono">
                      {new Date(ret.created_at).toLocaleDateString()}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Return Modal */}
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
                  <Box className="size-5 text-primary" /> Create Return / RMA
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-accent text-muted-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>
              <form onSubmit={handleCreateReturn} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Customer / Account</label>
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
                  <label className="block text-xs font-bold text-foreground mb-1">Order Ref / Subject</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Return request for Order #SO-10045"
                    className="w-full bg-background border border-border rounded-lg p-2 text-sm text-foreground focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Reason for Return</label>
                  <textarea
                    required
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe which items are returned, quantities, and damage details..."
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
                    {submitting ? "Creating..." : "Create RMA"}
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
