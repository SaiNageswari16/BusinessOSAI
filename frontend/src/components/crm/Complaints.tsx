import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, AlertTriangle, MessageSquare, Plus, Clock, User, CheckCircle2, X } from "lucide-react";
import { crmTicketsApi, crmCustomersApi, type CrmTicket, type CrmCustomer } from "@/lib/api-client";
import { useTenant } from "@/contexts/tenant-context";
import { toast } from "sonner";

export function Complaints() {
  const { tenant } = useTenant();
  const [searchTerm, setSearchTerm] = useState("");
  const [complaints, setComplaints] = useState<CrmTicket[]>([]);
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [submitting, setSubmitting] = useState(false);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const res = await crmTicketsApi.list("Complaint");
      setComplaints(res || []);
    } catch (err) {
      console.error("Failed to fetch complaints:", err);
      setComplaints([]);
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
    fetchComplaints();
    fetchCustomers();
  }, [tenant.id]);

  const handleLogComplaint = async (e: React.FormEvent) => {
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
        category: "Complaint",
      });
      toast.success("Complaint logged successfully!");
      setIsModalOpen(false);
      // Reset form
      setCustomerId("");
      setSubject("");
      setDescription("");
      setPriority("Medium");
      // Refetch
      fetchComplaints();
    } catch (err: any) {
      console.error("Failed to create complaint:", err);
      toast.error(err.message || "Failed to create complaint");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredComplaints = complaints.filter((comp) => {
    return (
      comp.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comp.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const getCustomerName = (custId: string | null) => {
    if (!custId) return "Walk-in / Guest";
    const found = customers.find((c) => c.id === custId);
    return found ? found.name : "Enterprise Client";
  };

  // Stats
  const criticalCount = complaints.filter((c) => c.priority === "High").length;
  const activeCount = complaints.filter((c) => c.status !== "Closed" && c.status !== "Resolved").length;
  const resolvedCount = complaints.filter((c) => c.status === "Resolved" || c.status === "Closed").length;
  const resolutionRate = complaints.length > 0 ? Math.round((resolvedCount / complaints.length) * 100) : 100;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Complaints</h1>
          <p className="text-sm text-muted-foreground">Track and manage customer grievances and escalations.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"
          >
            <Plus className="size-4" /> Log Complaint
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-xl border border-red-500/30 bg-red-500/5 relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 size-32 rounded-full blur-3xl bg-red-500/20" />
          <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">Critical & High Priority</p>
          <h3 className="text-4xl font-bold text-foreground">{criticalCount}</h3>
          <p className="text-xs font-medium mt-2 text-red-500 flex items-center gap-1">
            <AlertTriangle className="size-3" /> Requires immediate action
          </p>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-border/50 relative overflow-hidden group bg-card">
          <p className="text-sm font-medium text-muted-foreground mb-1">Active Cases</p>
          <h3 className="text-4xl font-bold text-foreground">{activeCount}</h3>
          <p className="text-xs font-medium mt-2 text-muted-foreground">Open investigations</p>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-border/50 relative overflow-hidden group bg-card">
          <p className="text-sm font-medium text-muted-foreground mb-1">Resolution Rate</p>
          <h3 className="text-4xl font-bold text-foreground">{resolutionRate}%</h3>
          <p className="text-xs font-medium mt-2 text-emerald-500 flex items-center gap-1">
            <CheckCircle2 className="size-3" /> Completed tickets
          </p>
        </div>
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden bg-card">
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search complaints..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-background/50 border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
            <Filter className="size-4" /> Filter
          </button>
        </div>

        <div className="divide-y divide-border/50">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading complaints…</div>
          ) : filteredComplaints.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No complaints logged yet.</div>
          ) : (
            filteredComplaints.map((comp, i) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                key={comp.id}
                className="p-4 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center cursor-pointer group"
              >
                <div className="flex gap-4 items-start">
                  <div
                    className={`p-2.5 rounded-lg shrink-0 ${
                      comp.priority === "High"
                        ? "bg-red-500/10 text-red-600"
                        : comp.priority === "Medium"
                          ? "bg-orange-500/10 text-orange-600"
                          : "bg-blue-500/10 text-blue-600"
                    }`}
                  >
                    <AlertTriangle className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-foreground text-base">{comp.subject}</h4>
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[80px]">
                        {comp.id.slice(0, 8)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80 mb-2">{comp.description}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <User className="size-3.5" /> {getCustomerName(comp.customer_id)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-3.5" /> {new Date(comp.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                  <span
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${
                      comp.status === "Open"
                        ? "bg-blue-500/10 text-blue-600"
                        : comp.status === "In Progress"
                          ? "bg-amber-500/10 text-amber-600"
                          : comp.status === "Resolved"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-slate-500/10 text-slate-600"
                    }`}
                  >
                    {comp.status}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Log Complaint Modal */}
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
                  <AlertTriangle className="size-5 text-primary" /> Log Customer Complaint
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-accent text-muted-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>
              <form onSubmit={handleLogComplaint} className="p-6 space-y-4">
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
                  <label className="block text-xs font-bold text-foreground mb-1">Complaint Subject</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Delayed shipment on Order #100"
                    className="w-full bg-background border border-border rounded-lg p-2 text-sm text-foreground focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Detailed Description</label>
                  <textarea
                    required
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide full details of the issue and what action the customer demands..."
                    className="w-full bg-background border border-border rounded-lg p-2 text-sm text-foreground focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Priority / Severity</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg p-2 text-sm text-foreground focus:outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High (Critical)</option>
                  </select>
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
                    {submitting ? "Logging..." : "Log Complaint"}
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
