import { toast } from "sonner";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Filter, FileCheck, FileText, Send, Building, Calendar, ExternalLink } from "lucide-react";
import { crmQuotationsApi, type CrmQuotation } from "@/lib/api-client";
import { useTenant } from "@/contexts/tenant-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrency } from "@/hooks/use-currency";

export function Quotations() {
    const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const [searchTerm, setSearchTerm] = useState("");
  const [quotations, setQuotations] = useState<CrmQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newQuote, setNewQuote] = useState({ quote_number: "", customer_name: "", total: 0, status: "Draft" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await crmQuotationsApi.create({
        quote_number: newQuote.quote_number,
        customer_name: newQuote.customer_name,
        total: newQuote.total,
        status: newQuote.status,
        customer_id: "00000000-0000-0000-0000-000000000000",
      });
      toast.success("Quotation created successfully!");
      setIsAddModalOpen(false);
      setNewQuote({ quote_number: "", customer_name: "", total: 0, status: "Draft" });
      void fetchQuotations();
    } catch(err: any) {
      toast.error(err?.message || "Failed to create quotation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const res = await crmQuotationsApi.list();
      setQuotations(res || []);
    } catch (err) {
      console.error("Failed to fetch quotations:", err);
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchQuotations();
  }, [tenant.id]);

  const filteredQuotes = quotations.filter(q => {
    return q.quote_number.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold tracking-tight">Quotations</h2>
          <p className="text-xs text-muted-foreground">Create, manage, and track professional sales quotations.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 h-8 gradient-brand text-white rounded-lg text-xs font-semibold shadow-elegant hover:opacity-90 transition-opacity">
                <Plus className="size-3.5" /> Create Quotation
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Quotation</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Quote Number</Label>
                  <Input required value={newQuote.quote_number} onChange={e => setNewQuote({...newQuote, quote_number: e.target.value})} placeholder="QT-2026-001" />
                </div>
                <div className="space-y-2">
                  <Label>Customer Name</Label>
                  <Input value={newQuote.customer_name} onChange={e => setNewQuote({...newQuote, customer_name: e.target.value})} placeholder="e.g. Acme Corp" />
                </div>
                <div className="space-y-2">
                  <Label>Total Amount ({currency.symbol})</Label>
                  <Input required type="number" min="0" value={newQuote.total} onChange={e => setNewQuote({...newQuote, total: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select value={newQuote.status} onChange={e => setNewQuote({...newQuote, status: e.target.value})} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent</option>
                    <option value="Approved">Approved</option>
                  </select>
                </div>
                <DialogFooter className="pt-4">
                  <button type="submit" disabled={isSubmitting} className="flex items-center justify-center gap-2 w-full px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                    {isSubmitting ? "Creating..." : "Create Quotation"}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Draft Quotes", value: "2", amount: "₹2,655", color: "text-slate-500", bg: "bg-slate-500/10" },
          { label: "Sent Quotes", value: "24", amount: "₹14,160", color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Approved Quotes", value: "8", amount: "₹64,000", color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Converted to Orders", value: "145", amount: "₹1.2M", color: "text-indigo-500", bg: "bg-indigo-500/10" },
        ].map((stat, i) => (
          <div key={i} className="glass-panel p-5 rounded-xl border border-border/50 bg-card">
            <div className="flex justify-between items-start mb-2">
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <div className={`px-2 py-1 rounded-md text-xs font-bold ${stat.bg} ${stat.color}`}>
                {stat.value}
              </div>
            </div>
            <h3 className="text-2xl font-bold text-foreground">{stat.amount}</h3>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 glass-panel p-4 rounded-xl border border-border/50 bg-card">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search quotations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none"
          />
        </div>
        <button onClick={() => toast.info('Feature coming soon!')} className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
          <Filter className="size-4" /> Filter
        </button>
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden bg-card">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading quotations…</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">Quote ID</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredQuotes.map((quote, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    key={quote.id} 
                    className="hover:bg-muted/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-foreground flex items-center gap-2">
                        <FileCheck className="size-4 text-primary" /> {quote.quote_number}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {quote.items?.items?.length || 0} Items
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-medium">
                        <Building className="size-4 text-muted-foreground" />
                        {(quote as any).customer_name || "Enterprise Client"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {new Date(quote.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-bold text-foreground text-right">
                      {currency.symbol}{Number(quote.total).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                        quote.status === 'Sent' ? 'bg-blue-500/10 text-blue-600' :
                        quote.status === 'Draft' ? 'bg-slate-500/10 text-slate-600' :
                        'bg-emerald-500/10 text-emerald-600'
                      }`}>
                        {quote.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => toast.info('Feature coming soon!')} className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors" title="Print">
                          <FileText className="size-4" />
                        </button>
                        <button onClick={() => toast.info('Feature coming soon!')} className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors" title="Send Email">
                          <Send className="size-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
