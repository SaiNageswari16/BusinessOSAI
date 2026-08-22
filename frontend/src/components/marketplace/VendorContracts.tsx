import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileCheck, Search, Filter, ShieldCheck, Clock, AlertTriangle, Plus, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { marketplaceApi } from "@/lib/marketplace-api";

export function VendorContracts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [contracts, setContracts] = useState([
    { id: "CTR-2026-001", vendorName: "Apex Tech Solutions", commissionRate: "8.5%", startDate: "2026-01-01", endDate: "2026-12-31", status: "Active", sla: "99.5% Uptime / 24h Shipping", autoRenew: true },
    { id: "CTR-2026-002", vendorName: "Global Logistics Hub", commissionRate: "12.0%", startDate: "2026-02-15", endDate: "2027-02-14", status: "Active", sla: "Same Day Delivery", autoRenew: true },
    { id: "CTR-2026-003", vendorName: "Urban Retail Group", commissionRate: "10.0%", startDate: "2025-06-01", endDate: "2026-05-31", status: "Pending Renewal", sla: "48h Shipping", autoRenew: false },
    { id: "CTR-2026-004", vendorName: "Nexus Supply Chain", commissionRate: "9.0%", startDate: "2026-03-01", endDate: "2027-02-28", status: "Active", sla: "Express Delivery Guaranteed", autoRenew: true },
    { id: "CTR-2026-005", vendorName: "Omni Electronics", commissionRate: "7.5%", startDate: "2025-01-01", endDate: "2025-12-31", status: "Expired", sla: "Standard Delivery", autoRenew: false },
  ]);

  const [vendorsList, setVendorsList] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContract, setNewContract] = useState({
    vendor_id: "",
    contract_number: `CTR-2026-${String(Math.floor(Math.random() * 900) + 100)}`,
    commission_rate: "8.5%",
    sla_terms: "99.5% Uptime / 24h Shipping",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    auto_renew: true,
  });

  const fetchContracts = async () => {
    try {
      const data = await marketplaceApi.getVendorContracts();
      if (data.contracts && data.contracts.length > 0) {
        setContracts(data.contracts);
      }
    } catch (err) {
      console.error("Failed to load contracts:", err);
    }
  };

  useEffect(() => {
    fetchContracts();
    marketplaceApi.getVendors().then(v => {
      if (v.vendors) setVendorsList(v.vendors);
      if (v.vendors && v.vendors.length > 0) {
        setNewContract(prev => ({ ...prev, vendor_id: v.vendors[0].id }));
      }
    }).catch(() => {});
  }, []);

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContract.vendor_id || !newContract.contract_number) return;
    try {
      const res = await marketplaceApi.createVendorContract(newContract);
      const selVendor = vendorsList.find(v => v.id === newContract.vendor_id);
      setContracts([
        {
          id: newContract.contract_number,
          vendorName: selVendor ? selVendor.name : "Registered Supplier",
          commissionRate: newContract.commission_rate,
          startDate: newContract.start_date,
          endDate: newContract.end_date,
          status: "Active",
          sla: newContract.sla_terms,
          autoRenew: newContract.auto_renew,
        },
        ...contracts,
      ]);
    } catch {
      setContracts([
        {
          id: newContract.contract_number,
          vendorName: "Registered Supplier",
          commissionRate: newContract.commission_rate,
          startDate: newContract.start_date,
          endDate: newContract.end_date,
          status: "Active",
          sla: newContract.sla_terms,
          autoRenew: newContract.auto_renew,
        },
        ...contracts,
      ]);
    }
    setShowAddModal(false);
  };

  const filtered = contracts.filter(c => {
    const matchesSearch = c.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) || c.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendor Contracts & SLAs</h1>
          <p className="text-sm text-muted-foreground">Manage commission rates, legal agreements, and SLA compliance.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search contracts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm font-medium focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending renewal">Pending Renewal</option>
            <option value="expired">Expired</option>
          </select>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
          >
            <Plus className="size-4" /> New Contract
          </button>
        </div>
      </div>

      <div className="glass-panel border border-border/50 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-3.5 px-4">Contract ID</th>
                <th className="py-3.5 px-4">Vendor</th>
                <th className="py-3.5 px-4">Commission</th>
                <th className="py-3.5 px-4">SLA Commitment</th>
                <th className="py-3.5 px-4">Validity</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map((ctr, i) => (
                <tr key={ctr.id} className="hover:bg-accent/30 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-xs font-semibold text-primary">{ctr.id}</td>
                  <td className="py-3.5 px-4 font-medium text-foreground">{ctr.vendorName}</td>
                  <td className="py-3.5 px-4 font-semibold text-emerald-600 dark:text-emerald-400">{ctr.commissionRate}</td>
                  <td className="py-3.5 px-4 text-xs text-muted-foreground flex items-center gap-1.5 mt-2">
                    <ShieldCheck className="size-3.5 text-blue-500" />
                    {ctr.sla}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-muted-foreground">
                    {ctr.startDate} → {ctr.endDate}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={cn("px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-wide uppercase",
                      ctr.status === "Active" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                      ctr.status === "Pending Renewal" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                      "bg-red-500/10 text-red-600 border border-red-500/20"
                    )}>
                      {ctr.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-background border border-border rounded-xl p-6 w-full max-w-lg shadow-2xl space-y-4"
          >
            <div className="border-b border-border/50 pb-3">
              <h2 className="text-xl font-bold text-foreground">Create Vendor SLA Contract</h2>
              <p className="text-xs text-muted-foreground">Draft and enforce commission terms and delivery SLA commitments.</p>
            </div>

            <form onSubmit={handleCreateContract} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Select Marketplace Vendor *</label>
                <select
                  value={newContract.vendor_id}
                  onChange={e => setNewContract({ ...newContract, vendor_id: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  required
                >
                  <option value="">-- Select Vendor --</option>
                  {vendorsList.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Contract Number *</label>
                  <input 
                    type="text" 
                    required
                    value={newContract.contract_number}
                    onChange={e => setNewContract({ ...newContract, contract_number: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Commission Rate (e.g. 8.5%) *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="8.5%"
                    value={newContract.commission_rate}
                    onChange={e => setNewContract({ ...newContract, commission_rate: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">SLA Fulfillment Terms</label>
                <input 
                  type="text" 
                  value={newContract.sla_terms}
                  onChange={e => setNewContract({ ...newContract, sla_terms: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Start Date</label>
                  <input 
                    type="date" 
                    value={newContract.start_date}
                    onChange={e => setNewContract({ ...newContract, start_date: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">End Date</label>
                  <input 
                    type="date" 
                    value={newContract.end_date}
                    onChange={e => setNewContract({ ...newContract, end_date: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-accent hover:bg-accent/80 rounded-lg text-sm font-medium transition-colors text-foreground"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Persist SLA Contract
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
