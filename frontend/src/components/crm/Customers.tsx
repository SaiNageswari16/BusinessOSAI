import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Filter, MoreHorizontal, Mail, Phone, MapPin, Building, Star, CreditCard, Download, Upload, Eye, Edit, Trash2 } from "lucide-react";
import { useCrmData } from "@/hooks/useCrmData";
import type { Customer } from "@/data/mockCrmData";
import { CustomerProfile } from "./CustomerProfile";
import { cn } from "@/lib/utils";

export function Customers() {
  const { mockCustomers, mockCrmStats } = useCrmData();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const filteredCustomers = mockCustomers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "All" || c.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground">Manage your {mockCrmStats.totalCustomers.toLocaleString()} customers across all segments.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
            <Download className="size-4" /> Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
            <Upload className="size-4" /> Import
          </button>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-4" /> Add Customer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Customers", value: mockCrmStats.totalCustomers.toLocaleString(), trend: "+12% this month", color: "text-blue-500" },
          { label: "Active Customers", value: mockCrmStats.activeCustomers.toLocaleString(), trend: "89% of total", color: "text-emerald-500" },
          { label: "New (30 Days)", value: mockCrmStats.newCustomersThisMonth.toLocaleString(), trend: "+5% vs last month", color: "text-amber-500" },
          { label: "Avg Rating", value: mockCrmStats.customerSatisfaction, trend: "Out of 5.0", color: "text-purple-500" },
        ].map((stat, i) => (
          <div key={i} className="glass-panel p-5 rounded-xl border border-border/50 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <p className="text-sm font-medium text-muted-foreground mb-1">{stat.label}</p>
            <h3 className="text-2xl font-bold text-foreground">{stat.value}</h3>
            <p className={cn("text-xs font-medium mt-2", stat.color)}>{stat.trend}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-4 glass-panel p-4 rounded-xl border border-border/50">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search customers by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
          {["All", "Retail", "Corporate", "Wholesale", "VIP"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                filterType === type
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-background/50 border border-border text-foreground hover:bg-accent"
              )}
            >
              {type}
            </button>
          ))}
          <button className="flex items-center gap-2 px-4 py-2 bg-background/50 border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors shrink-0">
            <Filter className="size-4" /> More Filters
          </button>
        </div>
      </div>

      {/* Customer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredCustomers.map((customer, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            key={customer.id}
            className="glass-panel rounded-xl border border-border/50 overflow-hidden hover:shadow-elegant transition-all duration-300 group"
          >
            <div className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <img src={customer.photo} alt={customer.name} className="size-12 rounded-full border-2 border-background shadow-sm" />
                  <div>
                    <h3 className="font-semibold text-foreground leading-tight">{customer.name}</h3>
                    <p className="text-xs text-muted-foreground">{customer.id}</p>
                  </div>
                </div>
                <div className="dropdown relative">
                  <button className="p-1.5 text-muted-foreground hover:bg-accent rounded-md transition-colors">
                    <MoreHorizontal className="size-4" />
                  </button>
                  {/* Dropdown menu mock */}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="size-3.5 shrink-0" />
                  <span className="truncate">{customer.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="size-3.5 shrink-0" />
                  <span>{customer.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building className="size-3.5 shrink-0" />
                  <span>{customer.type}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <span className={cn(
                  "px-2 py-1 rounded-md text-xs font-semibold",
                  customer.status === "Active" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
                )}>
                  {customer.status}
                </span>
                <span className={cn(
                  "px-2 py-1 rounded-md text-xs font-semibold",
                  customer.membership === "Platinum" ? "bg-indigo-500/10 text-indigo-600" :
                  customer.membership === "Diamond" ? "bg-cyan-500/10 text-cyan-600" :
                  customer.membership === "Gold" ? "bg-amber-500/10 text-amber-600" :
                  "bg-slate-500/10 text-slate-600"
                )}>
                  {customer.membership}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 bg-background/50 rounded-lg border border-border/50">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Wallet</p>
                  <p className="font-semibold text-sm">${customer.walletBalance.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Points</p>
                  <p className="font-semibold text-sm text-amber-600">{customer.loyaltyPoints.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-border/50 bg-muted/20 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => setSelectedCustomer(customer)}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1.5"
              >
                <Eye className="size-3.5" /> View Profile
              </button>
              <div className="flex items-center gap-2">
                <button className="text-muted-foreground hover:text-foreground transition-colors p-1"><Edit className="size-3.5" /></button>
                <button className="text-muted-foreground hover:text-red-500 transition-colors p-1"><Trash2 className="size-3.5" /></button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedCustomer && (
          <CustomerProfile 
            customer={selectedCustomer} 
            onClose={() => setSelectedCustomer(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
