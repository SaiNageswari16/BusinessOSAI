import { toast } from "sonner";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Filter, Rocket, Calendar, Building, ExternalLink } from "lucide-react";
import { crmOpportunitiesApi, type CrmOpportunity } from "@/lib/api-client";
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

export function Opportunities() {
    const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const [searchTerm, setSearchTerm] = useState("");
  const [opportunities, setOpportunities] = useState<CrmOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newOpp, setNewOpp] = useState({ name: "", customer_name: "", amount: 0, probability: 50, stage: "Prospecting" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await crmOpportunitiesApi.create(newOpp);
      toast.success("Opportunity created successfully!");
      setIsAddModalOpen(false);
      setNewOpp({ name: "", customer_name: "", amount: 0, probability: 50, stage: "Prospecting" });
      void fetchOpps();
    } catch(err: any) {
      toast.error(err?.message || "Failed to create opportunity");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchOpps = async () => {
    setLoading(true);
    try {
      const res = await crmOpportunitiesApi.list();
      setOpportunities(res || []);
    } catch (err) {
      console.error("Failed to fetch opportunities:", err);
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void fetchOpps();
  }, [tenant.id]);

  const filteredOpps = opportunities.filter(opp => {
    return opp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           opp.id.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Opportunities</h1>
          <p className="text-sm text-muted-foreground">List view of all active sales opportunities and potential revenue.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
                <Plus className="size-4" /> Add Opportunity
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Opportunity</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Opportunity Name</Label>
                  <Input required value={newOpp.name} onChange={e => setNewOpp({...newOpp, name: e.target.value})} placeholder="e.g. Enterprise License Deal" />
                </div>
                <div className="space-y-2">
                  <Label>Customer / Lead Name</Label>
                  <Input value={newOpp.customer_name} onChange={e => setNewOpp({...newOpp, customer_name: e.target.value})} placeholder="e.g. Acme Corp" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount ({currency.symbol})</Label>
                    <Input required type="number" min="0" value={newOpp.amount} onChange={e => setNewOpp({...newOpp, amount: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Probability (%)</Label>
                    <Input required type="number" min="0" max="100" value={newOpp.probability} onChange={e => setNewOpp({...newOpp, probability: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Stage</Label>
                  <select value={newOpp.stage} onChange={e => setNewOpp({...newOpp, stage: e.target.value})} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    <option value="Prospecting">Prospecting</option>
                    <option value="Qualification">Qualification</option>
                    <option value="Proposal">Proposal</option>
                    <option value="Negotiation">Negotiation</option>
                    <option value="Closed Won">Closed Won</option>
                    <option value="Closed Lost">Closed Lost</option>
                  </select>
                </div>
                <DialogFooter className="pt-4">
                  <button type="submit" disabled={isSubmitting} className="flex items-center justify-center gap-2 w-full px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                    {isSubmitting ? "Saving..." : "Save Opportunity"}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 glass-panel p-4 rounded-xl border border-border/50 bg-card">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search opportunities..."
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
            <div className="py-12 text-center text-muted-foreground">Loading sales pipeline…</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border/50">
                <tr>
                  <th className="px-6 py-4">Opportunity Name</th>
                  <th className="px-6 py-4">Customer / Lead</th>
                  <th className="px-6 py-4">Stage</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4">Probability</th>
                  <th className="px-6 py-4">Expected Close</th>
                  <th className="px-6 py-4">Owner</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredOpps.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                      No opportunities found for the selected company.
                    </td>
                  </tr>
                ) : (
                  filteredOpps.map((opp, i) => (
                    <motion.tr 
                      key={opp.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="hover:bg-muted/50 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <p className="font-semibold text-foreground flex items-center gap-2">
                          <Rocket className="size-4 text-primary" /> {opp.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">{opp.id}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 font-medium">
                          <Building className="size-4 text-muted-foreground" />
                          {(opp as any).customer_name || "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-accent border border-border text-foreground">
                          {opp.stage}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-emerald-600 text-right">
                        {currency.symbol}{Number(opp.amount).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-accent rounded-full overflow-hidden w-16">
                            <div className="h-full bg-primary" style={{ width: `${opp.probability}%` }} />
                          </div>
                          <span className="text-xs font-medium">{opp.probability}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">
                        <div className="flex items-center gap-2">
                          <Calendar className="size-4" /> 
                          {opp.expected_close_date ? new Date(opp.expected_close_date).toLocaleDateString() : "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium">{(opp as any).owner_name || "Platform Admin"}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => toast.info('Feature coming soon!')} className="text-primary hover:underline text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-auto bg-transparent border-none">
                          View Details <ExternalLink className="size-3" />
                        </button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
