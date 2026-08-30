import React, { useState, useEffect } from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { posApi } from "../lib/api-client";
import { motion, AnimatePresence } from "framer-motion";
import { useRbac } from "@/contexts/rbac-context";
import { Unauthorized } from "@/components/unauthorized";

import { PosTerminal } from "../components/pos/POSTerminal";
import { PosSalesInvoice } from "../components/pos/PosSalesInvoice";
import { PosPaymentIn } from "../components/pos/PosPaymentIn";
import { PosInvoicesHistory } from "../components/pos/PosInvoicesHistory";
import { Sparkles, ShieldCheck, TrendingUp, AlertTriangle, Clock, ArrowRightLeft, RefreshCw, CheckCircle, XCircle, Package, Users, BarChart3 } from "lucide-react";
import { posTransactions, posCustomers, paymentMethods, posStore, posSession, posDashboardStats, posProducts } from "../lib/pos-fallback";
import { useCurrency } from "@/hooks/use-currency";
import { formatCurrency } from "@/lib/utils";

export const Route = createFileRoute("/_app/pos")({ component: PosModule });

const fmt = (val: number) => formatCurrency(val);
const useView = () => new URLSearchParams(useRouterState().location.searchStr).get("view") || "all";

/* ─────────────────── SALES ─────────────────── */
function PosSales() {
  const view = useView();
  let rows = posTransactions;
  let title = "All Orders";
  let color = "text-indigo-600";

  if (view === "completed") { rows = posTransactions.filter(t => t.status === "Completed"); title = "Completed Orders"; color = "text-emerald-600"; }
  if (view === "cancelled") { rows = posTransactions.filter(t => t.status === "Refunded"); title = "Cancelled / Refunded"; color = "text-rose-600"; }
  if (view === "today") { rows = posTransactions.filter(t => new Date(t.date).toDateString() === new Date().toDateString()); title = "Today's Sales"; }
  if (view === "history") { rows = posTransactions.filter(t => new Date(t.date) < new Date(Date.now() - 86400000)); title = "Sales History (Past 30 Days)"; }
  if (view === "held") { rows = []; title = "Held Orders"; }
  if (view === "invoices") { title = "Sales Invoices"; }

  const totalVal = rows.reduce((s, t) => s + t.total, 0);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-sm text-slate-500 mt-1">{rows.length} records • Total: <span className={`font-bold ${color}`}>{fmt(totalVal)}</span></p>
        </div>
        {view === "invoices" && (
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">+ Generate Invoice</button>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border/70 p-24 text-center">
          <Clock className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">No held orders at this time.</p>
          <p className="text-muted-foreground/70 text-xs mt-1">Orders placed on hold from the terminal will appear here.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl shadow-xs border border-border/70 overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">Receipt No</th>
                <th className="px-4 py-3 text-left">Date & Time</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Cashier</th>
                <th className="px-4 py-3 text-left">Method</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 font-medium">
              {rows.slice(0, 20).map((t: any) => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold text-xs">{t.id}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(t.date).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{t.customerName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.cashier}</td>
                  <td className="px-4 py-3"><span className="bg-muted/60 text-foreground px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-border/40">{t.paymentMethod}</span></td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${t.status === "Completed" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"}`}>{t.status}</span></td>
                  <td className="px-4 py-3 text-right font-bold text-foreground">{fmt(t.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── CUSTOMERS ─────────────────── */
function PosCustomersPlaceholder() {
  const view = useView();

  if (view === "walk_in") return (
    <div className="p-4 max-w-2xl">
      <h2 className="text-2xl font-bold tracking-tight mb-2">Walk-in Customer</h2>
      <p className="text-xs text-muted-foreground mb-6">Register a new walk-in customer or proceed as anonymous guest.</p>
      <div className="bg-card p-6 rounded-2xl shadow-xs border border-border/70 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-bold text-foreground block mb-1.5">First Name</label><input className="w-full border border-border/70 rounded-xl p-2.5 text-xs bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="Enter first name" /></div>
          <div><label className="text-xs font-bold text-foreground block mb-1.5">Last Name</label><input className="w-full border border-border/70 rounded-xl p-2.5 text-xs bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="Enter last name" /></div>
        </div>
        <div><label className="text-xs font-bold text-foreground block mb-1.5">Mobile Number</label><input className="w-full border border-border/70 rounded-xl p-2.5 text-xs bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="+91 XXXXX XXXXX" /></div>
        <div><label className="text-xs font-bold text-foreground block mb-1.5">Email (Optional)</label><input className="w-full border border-border/70 rounded-xl p-2.5 text-xs bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="customer@example.com" /></div>
        <div className="flex gap-3 pt-2">
          <button className="flex-1 bg-indigo-600 text-white font-bold py-2.5 rounded-xl hover:bg-indigo-700 text-xs">Register & Open Bill</button>
          <button className="flex-1 bg-muted text-foreground font-bold py-2.5 rounded-xl hover:bg-muted/80 text-xs">Continue as Guest</button>
        </div>
      </div>
    </div>
  );

  if (view === "search") return (
    <div className="p-4">
      <h2 className="text-2xl font-bold tracking-tight mb-4">Customer Search & Lookup</h2>
      <div className="flex gap-3 mb-6">
        <input type="text" placeholder="Search by Name, Phone, Email or Customer ID..." className="flex-1 border border-border/70 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs bg-background" />
        <button className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs">Search</button>
      </div>
      <div className="bg-card rounded-2xl shadow-xs border border-border/70 overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
            <tr><th className="px-4 py-3 text-left">Customer</th><th className="px-4 py-3 text-left">Phone</th><th className="px-4 py-3 text-left">Email</th><th className="px-4 py-3 text-left">Tier</th><th className="px-4 py-3 text-left">Points</th><th className="px-4 py-3 text-center">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-border/30 font-medium">
            {posCustomers.filter(c => c.id !== "walk-in").map((c: any) => (
              <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.phone}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">{c.tier}</span></td>
                <td className="px-4 py-3 font-bold text-foreground">{c.points}</td>
                <td className="px-4 py-3 text-center"><button className="text-xs text-indigo-600 hover:underline font-semibold">Select</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (view === "loyalty") return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-6">Loyalty & Rewards Program</h2>
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-amber-100 to-amber-50 border border-amber-200 p-6 rounded-xl"><p className="text-amber-700 text-xs font-bold uppercase mb-1">Gold Members</p><h3 className="text-3xl font-black text-amber-800">142</h3></div>
        <div className="bg-gradient-to-br from-slate-200 to-slate-100 border border-slate-300 p-6 rounded-xl"><p className="text-slate-600 text-xs font-bold uppercase mb-1">Silver Members</p><h3 className="text-3xl font-black text-slate-800">485</h3></div>
        <div className="bg-gradient-to-br from-orange-100 to-orange-50 border border-orange-200 p-6 rounded-xl"><p className="text-orange-700 text-xs font-bold uppercase mb-1">Bronze Members</p><h3 className="text-3xl font-black text-orange-800">1,209</h3></div>
        <div className="bg-gradient-to-br from-indigo-100 to-indigo-50 border border-indigo-200 p-6 rounded-xl"><p className="text-indigo-700 text-xs font-bold uppercase mb-1">Points Issued Today</p><h3 className="text-3xl font-black text-indigo-800">3,450</h3></div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="font-bold text-lg mb-4">Top Loyalty Customers</h3>
        <div className="space-y-3">
          {posCustomers.filter(c => c.id !== "walk-in").map((c: any, i) => (
            <div key={c.id} className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-black text-sm">#{i + 1}</div>
                <div><p className="font-bold">{c.name}</p><p className="text-sm text-slate-500">{c.phone}</p></div>
              </div>
              <div className="text-right">
                <p className="font-black text-emerald-600 text-xl">{c.points} PTS</p>
                <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{c.tier}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (view === "membership") return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-6">Membership Plans</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { name: "Basic", price: "Free", color: "border-slate-300", bg: "bg-slate-50", members: 1209, perks: ["5% Cashback", "Birthday Bonus", "Newsletter"] },
          { name: "Silver", price: "$9.99/mo", color: "border-blue-300", bg: "bg-blue-50", members: 485, perks: ["10% Cashback", "Priority Queue", "Free Delivery", "Birthday Bonus"] },
          { name: "Gold", price: "$24.99/mo", color: "border-amber-400", bg: "bg-amber-50", members: 142, perks: ["20% Cashback", "Dedicated Cashier", "VIP Access", "Free Gifts", "Priority Queue"] },
        ].map(plan => (
          <div key={plan.name} className={`bg-white border-2 ${plan.color} rounded-xl p-6 relative`}>
            <div className={`${plan.bg} rounded-lg px-3 py-1 text-xs font-bold inline-block mb-4`}>{plan.members} Active Members</div>
            <h3 className="text-xl font-black mb-1">{plan.name}</h3>
            <p className="text-2xl font-black text-indigo-600 mb-6">{plan.price}</p>
            <ul className="space-y-2 text-sm">
              {plan.perks.map(p => <li key={p} className="flex items-center gap-2 text-slate-600"><CheckCircle className="w-4 h-4 text-emerald-500" />{p}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr><th className="px-6 py-3 text-left">Customer</th><th className="px-6 py-3 text-left">Plan</th><th className="px-6 py-3 text-left">Since</th><th className="px-6 py-3 text-left">Renewal</th><th className="px-6 py-3 text-left">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {posCustomers.filter(c => c.id !== "walk-in").map((c: any) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium">{c.name}</td>
                <td className="px-6 py-4"><span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold">{c.tier}</span></td>
                <td className="px-6 py-4 text-slate-500">Jan 2024</td>
                <td className="px-6 py-4 text-slate-500">Aug 2026</td>
                <td className="px-6 py-4"><span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">Active</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (view === "wallet") return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-6">Customer Wallets</h2>
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-indigo-600 border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Total Wallet Balance</p><h3 className="text-2xl font-black mt-1">{fmt(45200)}</h3></div>
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-emerald-600 border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Recharged Today</p><h3 className="text-2xl font-black mt-1">{fmt(1250)}</h3></div>
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-amber-500 border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Spent Today</p><h3 className="text-2xl font-black mt-1">{fmt(780)}</h3></div>
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-rose-500 border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Active Wallets</p><h3 className="text-2xl font-black mt-1">1,836</h3></div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr><th className="px-6 py-3">Customer</th><th className="px-6 py-3">Wallet ID</th><th className="px-6 py-3">Balance</th><th className="px-6 py-3">Last Recharge</th><th className="px-6 py-3">Last Spent</th><th className="px-6 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {posCustomers.filter(c => c.id !== "walk-in").map((c: any, i) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium">{c.name}</td>
                <td className="px-6 py-4 font-mono text-slate-500">WLT-{10000 + i * 137}</td>
                <td className="px-6 py-4 font-bold text-indigo-600">{fmt([320, 85, 540, 15][i] || 100)}</td>
                <td className="px-6 py-4 text-slate-500">2 days ago</td>
                <td className="px-6 py-4 text-slate-500">Today</td>
                <td className="px-6 py-4"><span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">Active</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (view === "gift_cards") return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Issued Gift Cards</h2>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">+ Issue New Gift Card</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[{ v: 100, code: "1234", exp: "06/26", s: "Active" }, { v: 250, code: "5678", exp: "12/26", s: "Active" }, { v: 50, code: "9012", exp: "03/26", s: "Redeemed" }, { v: 500, code: "3456", exp: "09/26", s: "Active" }, { v: 100, code: "7890", exp: "11/26", s: "Active" }, { v: 75, code: "2345", exp: "01/26", s: "Expired" }].map((gc, i) => (
          <div key={i} className={`p-6 rounded-xl shadow-lg text-white relative overflow-hidden ${gc.s === "Active" ? "bg-gradient-to-br from-slate-900 to-indigo-900" : gc.s === "Redeemed" ? "bg-gradient-to-br from-slate-600 to-slate-700" : "bg-gradient-to-br from-slate-500 to-slate-600"}`}>
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full" />
            <div className="flex justify-between items-start mb-6">
              <span className="text-xs font-bold opacity-70 uppercase tracking-widest">Store Gift Card</span>
              <span className={`px-2 py-1 rounded text-[10px] font-black ${gc.s === "Active" ? "bg-emerald-400/30 text-emerald-200" : "bg-white/20 text-white/70"}`}>{gc.s}</span>
            </div>
            <div className="text-4xl font-black mb-6">{fmt(gc.v)}</div>
            <div className="flex justify-between items-end opacity-70 font-mono text-xs">
              <span>**** **** **** {gc.code}</span><span>Exp: {gc.exp}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (view === "history") return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-6">Customer Purchase History</h2>
      <div className="flex gap-4 mb-6">
        <select className="border border-slate-200 rounded-lg px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {posCustomers.filter(c => c.id !== "walk-in").map(c => <option key={c.id}>{c.name}</option>)}
        </select>
        <select className="border border-slate-200 rounded-lg px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option>Last 30 Days</option><option>Last 90 Days</option><option>This Year</option><option>All Time</option>
        </select>
      </div>
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Total Spent</p><h3 className="text-2xl font-black mt-1 text-indigo-600">{fmt(2840)}</h3></div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Total Visits</p><h3 className="text-2xl font-black mt-1">18</h3></div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Avg. Bill Value</p><h3 className="text-2xl font-black mt-1">{fmt(157.8)}</h3></div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr><th className="px-6 py-3">Receipt No</th><th className="px-6 py-3">Date</th><th className="px-6 py-3">Items</th><th className="px-6 py-3">Payment</th><th className="px-6 py-3 text-right">Amount</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {posTransactions.slice(0, 12).map((t: any) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-6 py-3 font-mono text-indigo-600 text-xs">{t.id}</td>
                <td className="px-6 py-3 text-slate-600">{new Date(t.date).toLocaleDateString()}</td>
                <td className="px-6 py-3 text-slate-500">{t.items.length} items</td>
                <td className="px-6 py-3"><span className="bg-slate-100 px-2 py-1 rounded text-xs uppercase font-semibold">{t.paymentMethod}</span></td>
                <td className="px-6 py-3 text-right font-bold">{fmt(t.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Default: all customers
  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Customers Database</h2>
        <input type="text" placeholder="Search by name, phone, or ID..." className="border border-slate-200 rounded-lg px-4 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posCustomers.map((c: any) => (
          <div key={c.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:border-indigo-200 transition-colors cursor-pointer">
            <div className="h-14 w-14 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center font-black text-2xl">{c.name.charAt(0)}</div>
            <div>
              <h3 className="font-bold text-slate-900">{c.name}</h3>
              <p className="text-sm text-slate-500">{c.email || "—"} • {c.phone || "Guest"}</p>
              <div className="mt-2 flex gap-2">
                <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded">{c.tier || "GUEST"}</span>
                <span className="text-[10px] font-bold px-2 py-1 bg-emerald-50 text-emerald-600 rounded border border-emerald-100">{c.points} PTS</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────── PAYMENTS ─────────────────── */
function PosPayments() {
  const view = useView();

  if (view === "cash") return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-6">Cash Drawer — Denomination Breakdown</h2>
      <div className="flex gap-8">
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-bold text-lg mb-6 border-b pb-4">Current Float Count</h3>
          <div className="space-y-3">
            {[{ bill: "$100", count: 12 }, { bill: "$50", count: 25 }, { bill: "$20", count: 84 }, { bill: "$10", count: 45 }, { bill: "$5", count: 32 }, { bill: "$1", count: 120 }, { bill: "50¢", count: 60 }, { bill: "25¢", count: 120 }].map(d => (
              <div key={d.bill} className="flex items-center gap-4 border-b border-slate-50 pb-3">
                <div className="w-14 h-8 bg-green-50 border border-green-200 rounded flex items-center justify-center text-sm font-black text-green-800">{d.bill}</div>
                <span className="text-slate-500 flex-1">Denomination</span>
                <span className="font-mono bg-slate-100 px-3 py-1 rounded text-sm">× {d.count}</span>
                <span className="font-bold w-24 text-right">{fmt(parseFloat(d.bill.replace(/[$¢]/g, "")) * (d.bill.includes("¢") ? 0.01 : 1) * d.count)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="w-72 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Expected Total Cash</h3>
            <div className="text-4xl font-black text-emerald-600 mb-4">{fmt(4862.80)}</div>
            <button className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-black">Perform Blind Count</button>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-emerald-700 font-bold text-sm">Cash Status</p>
            <p className="text-emerald-600 text-xs mt-1">Last counted 2 hrs ago by {posSession.cashier}</p>
          </div>
        </div>
      </div>
    </div>
  );

  if (view === "card") return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Card Payments — POS Terminal</h2>
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-blue-600 border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Card Volume Today</p><h3 className="text-2xl font-black mt-1">{fmt(8450)}</h3></div>
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-indigo-600 border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Transactions</p><h3 className="text-2xl font-black mt-1">64</h3></div>
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-emerald-600 border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Approved</p><h3 className="text-2xl font-black mt-1 text-emerald-600">62</h3></div>
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-rose-600 border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Declined</p><h3 className="text-2xl font-black mt-1 text-rose-600">2</h3></div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="font-bold mb-4">Card Type Breakdown</h3>
          <div className="space-y-3">
            {[{ type: "Visa", pct: 45, amt: 3802 }, { type: "Mastercard", pct: 32, amt: 2704 }, { type: "Amex", pct: 15, amt: 1267 }, { type: "RuPay", pct: 8, amt: 677 }].map(c => (
              <div key={c.type}>
                <div className="flex justify-between text-sm mb-1"><span className="font-medium">{c.type}</span><span className="font-bold">{fmt(c.amt)}</span></div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-2 bg-indigo-500 rounded-full" style={{ width: `${c.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="font-bold mb-4">Terminal Status</h3>
          <div className="space-y-3">
            {[{ name: "EDC Terminal #1 (Counter 1)", status: "Online", tid: "TID-001" }, { name: "EDC Terminal #2 (Counter 2)", status: "Online", tid: "TID-002" }, { name: "Mobile EDC (Manager)", status: "Standby", tid: "TID-003" }].map(t => (
              <div key={t.tid} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div><p className="font-medium text-sm">{t.name}</p><p className="text-xs text-slate-400">{t.tid}</p></div>
                <span className={`px-2 py-1 rounded text-xs font-bold ${t.status === "Online" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{t.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (view === "upi") return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">UPI / QR Payment Terminal</h2>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col items-center text-center">
          <p className="text-sm font-bold text-slate-500 mb-4">Scan to Pay</p>
          <div className="w-48 h-48 border-4 border-indigo-600 p-3 rounded-xl mb-6 relative bg-white shadow-lg">
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center"><div className="w-2 h-2 bg-white rounded-full animate-pulse" /></div>
            <div className="w-full h-full bg-slate-100 grid grid-cols-7 grid-rows-7 gap-0.5 p-2 rounded">
              {Array.from({ length: 49 }).map((_, i) => <div key={i} className={`rounded-sm ${[0, 1, 2, 7, 8, 14, 35, 41, 42, 48, 47, 46, 6, 13, 34].includes(i) || Math.random() > 0.6 ? "bg-indigo-900" : "bg-white"}`} />)}
            </div>
          </div>
          <h3 className="font-bold text-lg mb-1">Ready to Accept Payment</h3>
          <p className="text-slate-500 text-sm mb-6">VPA: sunrise@upi</p>
          <div className="flex gap-2 flex-wrap justify-center">
            {["Google Pay", "PhonePe", "Paytm", "BHIM", "Amazon Pay"].map(a => <span key={a} className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600">{a}</span>)}
          </div>
        </div>
        <div className="col-span-2 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><p className="text-slate-500 text-xs">UPI Volume Today</p><h3 className="text-xl font-black mt-1">{fmt(3240)}</h3></div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><p className="text-slate-500 text-xs">Transactions</p><h3 className="text-xl font-black mt-1">47</h3></div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><p className="text-slate-500 text-xs">Success Rate</p><h3 className="text-xl font-black mt-1 text-emerald-600">98.7%</h3></div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold">Recent UPI Transactions</div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold">
                <tr><th className="px-4 py-3 text-left">UPI Ref</th><th className="px-4 py-3 text-left">Customer VPA</th><th className="px-4 py-3 text-left">Time</th><th className="px-4 py-3 text-right">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {posTransactions.filter(t => t.paymentMethod === "upi").slice(0, 8).map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-indigo-600">UPI{t.id.slice(-8)}</td>
                    <td className="px-4 py-3 text-slate-500">{t.customerName.split(" ")[0].toLowerCase()}@oksbi</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(t.date).toLocaleTimeString()}</td>
                    <td className="px-4 py-3 text-right font-bold">{fmt(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  if (view === "split") return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-2xl font-bold mb-2">Split Payment</h2>
      <p className="text-slate-500 mb-8">Allow customer to pay using multiple payment methods for a single bill.</p>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
          <span className="font-bold text-lg">Bill Total</span>
          <span className="text-2xl font-black text-indigo-600">{fmt(342.50)}</span>
        </div>
        <div className="space-y-4 mb-6">
          {[{ method: "Cash", amount: 100 }, { method: "Card", amount: 200 }].map((s, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-bold text-sm w-24">{s.method}</span>
              <input type="number" className="flex-1 border border-slate-200 rounded-lg p-2 text-sm focus:border-indigo-500 focus:outline-none" defaultValue={s.amount} />
              <button className="text-rose-400 hover:text-rose-600"><XCircle className="w-5 h-5" /></button>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm font-bold mb-2 text-slate-500 px-1"><span>Allocated</span><span>{fmt(300)}</span></div>
        <div className="flex justify-between text-sm font-bold mb-6 px-1 text-rose-600"><span>Remaining</span><span>{fmt(42.50)}</span></div>
        <button className="w-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold py-3 rounded-lg mb-4 hover:bg-indigo-100">+ Add Payment Method</button>
        <button className="w-full bg-indigo-600 text-white font-bold py-4 rounded-lg shadow-md hover:bg-indigo-700">Process Split Payment</button>
      </div>
    </div>
  );

  if (view === "refunds") return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Refund History</h2>
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-rose-500 border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Total Refunded Today</p><h3 className="text-2xl font-black mt-1 text-rose-600">{fmt(posDashboardStats.refunds)}</h3></div>
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-amber-500 border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Refund Count</p><h3 className="text-2xl font-black mt-1">{posDashboardStats.refundCount}</h3></div>
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-slate-400 border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Avg. Refund Value</p><h3 className="text-2xl font-black mt-1">{fmt(posDashboardStats.refundCount > 0 ? posDashboardStats.refunds / posDashboardStats.refundCount : 0)}</h3></div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr><th className="px-6 py-3">Refund ID</th><th className="px-6 py-3">Original Receipt</th><th className="px-6 py-3">Customer</th><th className="px-6 py-3">Date</th><th className="px-6 py-3">Method</th><th className="px-6 py-3 text-right">Refunded</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {posTransactions.filter(t => t.status === "Refunded").slice(0, 15).map((t: any) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-6 py-3 font-mono text-rose-600 text-xs">REF-{t.id.slice(-6)}</td>
                <td className="px-6 py-3 font-mono text-slate-400 text-xs">{t.id}</td>
                <td className="px-6 py-3 font-medium">{t.customerName}</td>
                <td className="px-6 py-3 text-slate-500">{new Date(t.date).toLocaleDateString()}</td>
                <td className="px-6 py-3"><span className="bg-slate-100 px-2 py-1 rounded text-xs uppercase font-semibold">{t.paymentMethod}</span></td>
                <td className="px-6 py-3 text-right font-bold text-rose-600">-{fmt(t.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Default: all payment methods overview
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Payment Methods Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paymentMethods.map((p, i) => {
          const vols = [4860, 8450, 3240, 1200, 650];
          return (
            <div key={p.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-2xl">{["💵", "💳", "📱", "👛", "🎁"][i]}</div>
                <span className="text-[10px] font-black px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">ACTIVE</span>
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">{p.label}</h3>
              <p className="text-3xl font-black text-slate-800 mt-3">{fmt(vols[i])}</p>
              <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-bold">Today's Volume</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────── STORE OPERATIONS ─────────────────── */
function PosStoreOperations() {
  const view = useView();

  const { data: summaryData } = useQuery<any>({
    queryKey: ["pos-daily-summary"],
    queryFn: () => posApi.getDailySummary(),
    refetchInterval: 60000,
  });

  const todayRevenue = summaryData?.total_revenue || 0;
  const cashSales = summaryData?.breakdown?.cash || 0;
  const cardSales = summaryData?.breakdown?.card || 0;
  const upiSales = summaryData?.breakdown?.upi || 0;
  const totalRefunds = summaryData?.total_returns || 0;
  const expectedCash = posSession.openingFloat + cashSales;

  if (view === "shift") return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Open / Close Shift</h2>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4 border-b pb-4">
            <h3 className="font-bold text-lg">Current Shift</h3>
            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">● OPEN</span>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">Cashier</span><span className="font-bold text-indigo-600">{posSession.cashier}</span></div>
            <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">Shift</span><span className="font-bold">{posSession.shift} Shift</span></div>
            <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">Register</span><span className="font-mono bg-slate-100 px-2 rounded">{posSession.registerId}</span></div>
            <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">Opened At</span><span className="font-medium">{new Date(posSession.openedAt).toLocaleTimeString()}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-500">Opening Float</span><span className="font-black text-lg">{fmt(posSession.openingFloat)}</span></div>
          </div>
          <button className="w-full mt-6 bg-rose-50 text-rose-700 font-bold py-3 rounded-lg border border-rose-200 hover:bg-rose-100">Close Register & End Shift</button>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-lg mb-4 border-b pb-4">Open a New Shift</h3>
          <div className="space-y-4">
            <div><label className="text-sm font-bold text-slate-700 block mb-2">Cashier</label>
              <select className="w-full border-2 border-slate-200 rounded-lg p-3 focus:border-indigo-500 focus:outline-none">
                <option>Ananya Sharma</option><option>Rohan Mehta</option><option>Divya Nair</option>
              </select>
            </div>
            <div><label className="text-sm font-bold text-slate-700 block mb-2">Register</label>
              <select className="w-full border-2 border-slate-200 rounded-lg p-3 focus:border-indigo-500 focus:outline-none">
                <option>REG-01</option><option>REG-02</option><option>REG-03</option>
              </select>
            </div>
            <div><label className="text-sm font-bold text-slate-700 block mb-2">Opening Float Amount</label>
              <input type="number" className="w-full border-2 border-slate-200 rounded-lg p-3 focus:border-indigo-500 focus:outline-none" placeholder="0.00" />
            </div>
            <button className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 mt-4">Open New Shift</button>
          </div>
        </div>
      </div>
    </div>
  );

  if (view === "drawer") return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Cash Drawer Management</h2>
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-emerald-600 border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Opening Float</p><h3 className="text-2xl font-black mt-1">{fmt(posSession.openingFloat)}</h3></div>
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-indigo-600 border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Cash Sales Today</p><h3 className="text-2xl font-black mt-1">{fmt(cashSales)}</h3></div>
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-amber-500 border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Expected Drawer Balance</p><h3 className="text-2xl font-black mt-1">{fmt(expectedCash)}</h3></div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="font-bold mb-4">Drawer Activity Log</h3>
          <div className="space-y-3">
            {[{ time: "08:00", action: "Shift Opened", amount: 350, type: "in" }, { time: "10:15", action: "Cash Sale", amount: 89.50, type: "in" }, { time: "11:42", action: "Safe Drop", amount: -200, type: "out" }, { time: "13:30", action: "Cash Sale", amount: 245, type: "in" }, { time: "14:05", action: "Vendor Payment", amount: -50, type: "out" }].map((a, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
                <span className="text-slate-400 font-mono w-12">{a.time}</span>
                <span className="flex-1 mx-3 font-medium">{a.action}</span>
                <span className={`font-bold ${a.type === "in" ? "text-emerald-600" : "text-rose-600"}`}>{a.type === "in" ? "+" : ""}{fmt(a.amount)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="font-bold mb-4">Drawer Controls</h3>
          <div className="space-y-3">
            <button className="w-full py-4 bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 rounded-xl hover:bg-indigo-100 text-sm">🔓 Open Cash Drawer</button>
            <button className="w-full py-4 bg-slate-50 text-slate-700 font-bold border border-slate-200 rounded-xl hover:bg-slate-100 text-sm">📊 Print Drawer Report</button>
            <button className="w-full py-4 bg-amber-50 text-amber-700 font-bold border border-amber-200 rounded-xl hover:bg-amber-100 text-sm">💰 Record Safe Drop</button>
          </div>
        </div>
      </div>
    </div>
  );

  if (view === "cash_io") return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-2xl font-bold mb-2">Cash In / Cash Out</h2>
      <p className="text-slate-500 mb-8">Record non-sale cash movements in and out of the register.</p>
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex gap-4 mb-8">
          <button className="flex-1 py-3 bg-emerald-50 text-emerald-700 font-bold border-2 border-emerald-300 rounded-lg">↑ Cash In (Float/Drop)</button>
          <button className="flex-1 py-3 bg-slate-50 text-slate-600 font-bold border-2 border-slate-200 rounded-lg">↓ Cash Out (Expense)</button>
        </div>
        <div className="space-y-5">
          <div><label className="text-sm font-bold text-slate-700 block mb-2">Amount</label><input type="number" className="w-full border-2 border-slate-200 rounded-lg p-3 text-xl font-mono focus:border-indigo-500 focus:outline-none" placeholder="0.00" /></div>
          <div><label className="text-sm font-bold text-slate-700 block mb-2">Reason</label>
            <select className="w-full border-2 border-slate-200 rounded-lg p-3 focus:border-indigo-500 focus:outline-none">
              <option>Safe Drop / Float Addition</option><option>Vendor Payment</option><option>Store Supplies</option><option>Petty Cash</option><option>Other Expense</option>
            </select>
          </div>
          <div><label className="text-sm font-bold text-slate-700 block mb-2">Approved By</label>
            <select className="w-full border-2 border-slate-200 rounded-lg p-3 focus:border-indigo-500 focus:outline-none">
              <option>Store Manager</option><option>Assistant Manager</option>
            </select>
          </div>
          <div><label className="text-sm font-bold text-slate-700 block mb-2">Remarks</label><textarea className="w-full border-2 border-slate-200 rounded-lg p-3 focus:border-indigo-500 focus:outline-none" rows={3} placeholder="Add notes..." /></div>
          <button className="w-full bg-indigo-600 text-white font-bold py-4 rounded-lg shadow-md hover:bg-indigo-700">Record Transaction</button>
        </div>
      </div>
    </div>
  );

  if (view === "register") return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Register Closing</h2>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold mb-5 text-lg border-b pb-3">Closing Summary</h3>
          <div className="space-y-3 text-sm">
            {[{ label: "Opening Float", val: fmt(posSession.openingFloat) }, { label: "Cash Sales", val: fmt(cashSales) }, { label: "Card Sales", val: fmt(cardSales) }, { label: "UPI Sales", val: fmt(upiSales) }, { label: "Total Revenue", val: fmt(todayRevenue), bold: true }, { label: "Total Refunds", val: `-${fmt(totalRefunds)}`, red: true }, { label: "Expected Cash", val: fmt(expectedCash), bold: true }].map(r => (
              <div key={r.label} className={`flex justify-between py-2 ${r.bold ? "border-t border-slate-200 pt-3" : "border-b border-slate-50"}`}>
                <span className="text-slate-500">{r.label}</span>
                <span className={`${r.bold ? "font-black text-lg" : "font-medium"} ${r.red ? "text-rose-600" : ""}`}>{r.val}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold mb-4">Actual Cash Count</h3>
            <input type="number" className="w-full border-2 border-slate-200 rounded-lg p-3 text-2xl font-mono focus:border-indigo-500 focus:outline-none mb-3" placeholder="Enter counted amount" />
            <p className="text-sm text-slate-500">Enter the actual cash counted in the drawer before closing.</p>
          </div>
          <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-lg shadow-md hover:bg-black">Submit & Close Register</button>
        </div>
      </div>
    </div>
  );

  if (view === "eod") return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-2">End of Day — Z-Report</h2>
      <p className="text-slate-500 mb-8">Review today's summary before processing end of day closure.</p>
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-indigo-600"><p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Revenue</p><h3 className="text-2xl font-black">{fmt(posDashboardStats.todayRevenue)}</h3></div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-emerald-600"><p className="text-xs font-bold text-slate-500 uppercase mb-1">Orders Today</p><h3 className="text-2xl font-black">{posDashboardStats.todayOrders}</h3></div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-rose-500"><p className="text-xs font-bold text-slate-500 uppercase mb-1">Refunds</p><h3 className="text-2xl font-black text-rose-600">{fmt(posDashboardStats.refunds)}</h3></div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-amber-500"><p className="text-xs font-bold text-slate-500 uppercase mb-1">Avg. Bill</p><h3 className="text-2xl font-black">{fmt(posDashboardStats.avgBill)}</h3></div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-6">
        <h3 className="font-bold mb-4">Payment Method Breakup</h3>
        <div className="grid grid-cols-3 gap-4">
          {[{ m: "Cash", v: 4860 }, { m: "Card", v: 8450 }, { m: "UPI", v: 3240 }].map(p => (
            <div key={p.m} className="p-4 bg-slate-50 rounded-lg"><p className="font-bold text-sm">{p.m}</p><p className="text-xl font-black mt-1 text-indigo-600">{fmt(p.v)}</p></div>
          ))}
        </div>
      </div>
      <button className="w-full bg-slate-900 text-white font-bold py-5 rounded-xl shadow-lg hover:bg-black text-lg">🏁 Process Z-Report & Close Day</button>
    </div>
  );

  // Default
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Store & Register Status</h2>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <h3 className="font-bold text-lg">Active Shift</h3>
            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">● LIVE</span>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">Store</span><span className="font-medium">{posStore.name}</span></div>
            <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">Branch</span><span className="font-medium">{posStore.branch}</span></div>
            <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">Cashier</span><span className="font-bold text-indigo-600">{posSession.cashier}</span></div>
            <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">Register</span><span className="font-mono bg-slate-100 px-2 rounded">{posSession.registerId}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-500">Opened At</span><span>{new Date(posSession.openedAt).toLocaleTimeString()}</span></div>
          </div>
        </div>
        <div className="grid grid-rows-3 gap-4">
          {[{ icon: "⏱", label: "Open/Close Shift", desc: "Manage shift timings" }, { icon: "💰", label: "Cash In/Out", desc: "Record cash movements" }, { icon: "🔒", label: "End of Day", desc: "Process Z-report" }].map(a => (
            <div key={a.label} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 cursor-pointer hover:border-indigo-200">
              <div className="text-3xl">{a.icon}</div>
              <div><p className="font-bold">{a.label}</p><p className="text-sm text-slate-500">{a.desc}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── RETURNS ─────────────────── */
function PosReturns() {
  const view = useView();
  const refunds = posTransactions.filter(t => t.status === "Refunded");

  if (view === "exchange") return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-2xl font-bold mb-2">Product Exchange</h2>
      <p className="text-slate-500 mb-8">Find the original transaction and select product to exchange.</p>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-5">
        <div><label className="text-sm font-bold text-slate-700 block mb-2">Original Receipt / Order ID</label>
          <div className="flex gap-3"><input className="flex-1 border-2 border-slate-200 rounded-lg p-3 focus:border-indigo-500 focus:outline-none" placeholder="Enter Receipt No (e.g. TRX-XXXXXX-0)" />
            <button className="px-5 py-3 bg-indigo-600 text-white rounded-lg font-bold">Find</button>
          </div>
        </div>
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <p className="font-bold mb-3 text-sm">Original Items</p>
          {posTransactions[0].items.map((item: any, i: number) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-slate-100 text-sm">
              <span>{item.name} × {item.qty}</span>
              <span className="font-bold">{fmt(item.total)}</span>
            </div>
          ))}
        </div>
        <div><label className="text-sm font-bold text-slate-700 block mb-2">Reason for Exchange</label>
          <select className="w-full border-2 border-slate-200 rounded-lg p-3 focus:border-indigo-500 focus:outline-none">
            <option>Wrong Size / Variant</option><option>Defective Product</option><option>Customer Changed Mind</option><option>Wrong Item Delivered</option>
          </select>
        </div>
        <button className="w-full bg-indigo-600 text-white font-bold py-4 rounded-lg hover:bg-indigo-700">Process Exchange</button>
      </div>
    </div>
  );

  if (view === "store_credit") return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Store Credit</h2>
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-indigo-600 border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Outstanding Store Credit</p><h3 className="text-2xl font-black mt-1">{fmt(3450)}</h3></div>
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-emerald-500 border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Issued Today</p><h3 className="text-2xl font-black mt-1">{fmt(620)}</h3></div>
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-amber-500 border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Redeemed Today</p><h3 className="text-2xl font-black mt-1">{fmt(280)}</h3></div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr><th className="px-6 py-3 text-left">Customer</th><th className="px-6 py-3 text-left">Credit Note ID</th><th className="px-6 py-3 text-left">Issued On</th><th className="px-6 py-3 text-left">Expires</th><th className="px-6 py-3 text-right">Amount</th><th className="px-6 py-3 text-left">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {posCustomers.filter(c => c.id !== "walk-in").map((c: any, i) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium">{c.name}</td>
                <td className="px-6 py-4 font-mono text-slate-500">CN-2024-{1000 + i}</td>
                <td className="px-6 py-4 text-slate-500">May 15, 2026</td>
                <td className="px-6 py-4 text-slate-500">Nov 15, 2026</td>
                <td className="px-6 py-4 text-right font-bold text-indigo-600">{fmt([150, 75, 320, 45][i] || 100)}</td>
                <td className="px-6 py-4"><span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">Valid</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (view === "damaged") return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Damaged Products Log</h2>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr><th className="px-6 py-3 text-left">Product</th><th className="px-6 py-3 text-left">SKU</th><th className="px-6 py-3 text-left">Reported By</th><th className="px-6 py-3 text-left">Date</th><th className="px-6 py-3 text-left">Damage Type</th><th className="px-6 py-3 text-right">Est. Loss</th><th className="px-6 py-3">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {posProducts.slice(0, 8).map((p: any, i) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium">{p.name}</td>
                <td className="px-6 py-4 font-mono text-slate-400 text-xs">{p.sku}</td>
                <td className="px-6 py-4 text-slate-500">{posSession.cashier}</td>
                <td className="px-6 py-4 text-slate-500">Jul {10 + i}, 2026</td>
                <td className="px-6 py-4"><span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-bold">{["Physical Damage", "Expiry", "Transit Damage", "Theft"][i % 4]}</span></td>
                <td className="px-6 py-4 text-right font-bold text-rose-600">{fmt(p.price * (i % 3 + 1))}</td>
                <td className="px-6 py-4"><button className="text-xs font-bold text-indigo-600 border border-indigo-200 bg-indigo-50 px-3 py-1 rounded">Write Off</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Default: returns/refund table
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">{view === "refund" ? "Refunds" : "Product Returns"}</h2>
          <p className="text-sm text-slate-500 mt-1">{refunds.length} records found</p>
        </div>
        <button className="px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-sm font-bold hover:bg-rose-100">+ New Return</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr><th className="px-6 py-3">Return ID</th><th className="px-6 py-3">Original Receipt</th><th className="px-6 py-3">Customer</th><th className="px-6 py-3">Date</th><th className="px-6 py-3">Status</th><th className="px-6 py-3 text-right">Amount</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {refunds.slice(0, 15).map((t: any) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-mono text-rose-600 text-xs">RTN-{t.id.slice(-6)}</td>
                <td className="px-6 py-4 font-mono text-slate-400 text-xs">{t.id}</td>
                <td className="px-6 py-4 font-medium">{t.customerName}</td>
                <td className="px-6 py-4 text-slate-500">{new Date(t.date).toLocaleDateString()}</td>
                <td className="px-6 py-4"><span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-bold">Processed</span></td>
                <td className="px-6 py-4 text-right font-bold text-rose-600">-{fmt(t.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────── DEVICES ─────────────────── */
const allDevices = [
  { id: "printer", name: "Epson TM-T88V", model: "TM-T88V Receipt Printer", type: "Receipt Printer", status: "Online", ip: "192.168.1.45", port: "9100", driver: "Epson OPOS", lastPrint: "2 mins ago" },
  { id: "barcode", name: "Zebra DS2208", model: "DS2208 USB Barcode Scanner", type: "Barcode Scanner", status: "Online", ip: "USB HID", port: "—", driver: "HID Keyboard", lastPrint: "Active" },
  { id: "drawer", name: "APG Vasario", model: "Vasario 1515 Cash Drawer", type: "Cash Drawer", status: "Online", ip: "Driven by Printer", port: "—", driver: "APG OpenPort", lastPrint: "8 mins ago" },
  { id: "display", name: "Posiflex PD-300", model: "PD-300 Customer Display", type: "Pole Display", status: "Offline", ip: "192.168.1.46", port: "4999", driver: "VFD Display", lastPrint: "N/A" },
  { id: "scale", name: "Avery Berkel FX120", model: "FX120 Retail Scale", type: "Weight Scale", status: "Online", ip: "COM4", port: "—", driver: "OHAUS Serial", lastPrint: "Active" },
];

function PosDevices() {
  const view = useView();
  const devices = view === "all" ? allDevices : allDevices.filter(d => d.id === view);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{view === "all" ? "All Connected Devices" : devices[0]?.type || "Device"}</h2>
        <button className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-bold hover:bg-indigo-100">+ Add Device</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {devices.map((d) => (
          <div key={d.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-black text-slate-900 text-lg">{d.name}</h3>
                <p className="text-sm text-slate-500">{d.model}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${d.status === "Online" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                {d.status === "Online" ? "● Online" : "○ Offline"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm mb-5">
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-slate-400 text-xs mb-1">Type</p><p className="font-semibold">{d.type}</p></div>
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-slate-400 text-xs mb-1">IP / Port</p><p className="font-mono font-semibold text-xs">{d.ip}</p></div>
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-slate-400 text-xs mb-1">Driver</p><p className="font-semibold text-xs">{d.driver}</p></div>
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-slate-400 text-xs mb-1">Last Activity</p><p className="font-semibold text-xs">{d.lastPrint}</p></div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 text-sm font-bold text-indigo-600 border border-indigo-200 bg-indigo-50 py-2 rounded-lg hover:bg-indigo-100">⚙ Configure</button>
              <button className="flex-1 text-sm font-bold text-slate-600 border border-slate-200 bg-slate-50 py-2 rounded-lg hover:bg-slate-100">🔄 Test</button>
              {d.status === "Offline" && <button className="flex-1 text-sm font-bold text-emerald-600 border border-emerald-200 bg-emerald-50 py-2 rounded-lg hover:bg-emerald-100">↺ Reconnect</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────── REPORTS ─────────────────── */
function PosReports() {
  const view = useView();

  if (view === "sales") return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Daily / Hourly Sales Report</h2>
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-5 rounded-xl border-t-4 border-t-indigo-600 border border-slate-200 shadow-sm"><p className="text-xs font-bold text-slate-500 uppercase">Today's Revenue</p><h3 className="text-xl font-black mt-1">{fmt(posDashboardStats.todayRevenue)}</h3><p className="text-emerald-600 text-xs mt-1 font-bold">+12.5%</p></div>
        <div className="bg-white p-5 rounded-xl border-t-4 border-t-emerald-600 border border-slate-200 shadow-sm"><p className="text-xs font-bold text-slate-500 uppercase">Orders</p><h3 className="text-xl font-black mt-1">{posDashboardStats.todayOrders}</h3><p className="text-emerald-600 text-xs mt-1 font-bold">+4.2%</p></div>
        <div className="bg-white p-5 rounded-xl border-t-4 border-t-amber-500 border border-slate-200 shadow-sm"><p className="text-xs font-bold text-slate-500 uppercase">Avg. Bill</p><h3 className="text-xl font-black mt-1">{fmt(posDashboardStats.avgBill)}</h3><p className="text-rose-500 text-xs mt-1 font-bold">-1.1%</p></div>
        <div className="bg-white p-5 rounded-xl border-t-4 border-t-rose-500 border border-slate-200 shadow-sm"><p className="text-xs font-bold text-slate-500 uppercase">Refunds</p><h3 className="text-xl font-black mt-1 text-rose-600">{fmt(posDashboardStats.refunds)}</h3><p className="text-slate-400 text-xs mt-1 font-bold">Today</p></div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold mb-4">Hourly Sales Breakdown</h3>
        <div className="flex items-end gap-3 h-40">
          {[8, 10, 14, 22, 18, 30, 42, 38, 25, 16, 12, 8].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-bold text-slate-400">{fmt(h * 50).replace("$", "")}</span>
              <div className="w-full bg-indigo-500 rounded-t-md" style={{ height: `${h / 42 * 100}%` }} />
              <span className="text-[10px] text-slate-400">{8 + i}h</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (view === "cash") return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Cash Report</h2>
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold mb-4 border-b pb-3">Cash Flow Summary</h3>
          {[{ label: "Opening Float", val: posSession.openingFloat, color: "" }, { label: "Cash Sales", val: 4510, color: "text-emerald-600" }, { label: "Cash Refunds", val: -320, color: "text-rose-600" }, { label: "Safe Drop", val: -2000, color: "text-amber-600" }, { label: "Cash In (Other)", val: 150, color: "text-emerald-600" }].map(r => (
            <div key={r.label} className="flex justify-between py-2 border-b border-slate-50 text-sm">
              <span className="text-slate-500">{r.label}</span><span className={`font-bold ${r.color}`}>{fmt(r.val)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-4 font-black text-lg border-t border-slate-200 mt-2"><span>Expected Closing Cash</span><span className="text-indigo-600">{fmt(posSession.openingFloat + 4510 - 320 - 2000 + 150)}</span></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold mb-4 border-b pb-3">Safe Drop Log</h3>
          <div className="space-y-3">
            {[{ time: "10:30", amount: 500, by: "Manager" }, { time: "13:15", amount: 800, by: "Manager" }, { time: "16:00", amount: 700, by: "Sr. Cashier" }].map((s, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
                <span className="text-slate-500">{s.time}</span>
                <span className="font-medium">Drop by {s.by}</span>
                <span className="font-bold text-indigo-600">-{fmt(s.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (view === "payment") return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Payment Report</h2>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr><th className="px-6 py-3 text-left">Payment Method</th><th className="px-6 py-3 text-right">Transactions</th><th className="px-6 py-3 text-right">Total Amount</th><th className="px-6 py-3 text-right">Refunds</th><th className="px-6 py-3 text-right">Net</th><th className="px-6 py-3 text-right">% of Total</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[{ m: "Cash", txn: 52, total: 4860, ref: 320, pct: 28 }, { m: "Credit/Debit Card", txn: 64, total: 8450, ref: 180, pct: 49 }, { m: "UPI (QR)", txn: 47, total: 3240, ref: 0, pct: 19 }, { m: "Store Wallet", txn: 8, total: 420, ref: 0, pct: 2 }, { m: "Gift Card", txn: 3, total: 180, ref: 0, pct: 1 }].map(p => (
              <tr key={p.m} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium">{p.m}</td>
                <td className="px-6 py-4 text-right">{p.txn}</td>
                <td className="px-6 py-4 text-right font-bold">{fmt(p.total)}</td>
                <td className="px-6 py-4 text-right text-rose-600">-{fmt(p.ref)}</td>
                <td className="px-6 py-4 text-right font-bold text-indigo-600">{fmt(p.total - p.ref)}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2"><div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-2 bg-indigo-500 rounded-full" style={{ width: `${p.pct}%` }} /></div><span className="text-xs font-bold">{p.pct}%</span></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (view === "tax") return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Tax Report</h2>
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-indigo-600 border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Total Tax Collected</p><h3 className="text-2xl font-black mt-1">{fmt(posDashboardStats.todayRevenue * 0.05)}</h3></div>
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-emerald-600 border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Taxable Sales</p><h3 className="text-2xl font-black mt-1">{fmt(posDashboardStats.todayRevenue)}</h3></div>
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-amber-500 border border-slate-200 shadow-sm"><p className="text-slate-500 text-sm">Tax-Exempt Sales</p><h3 className="text-2xl font-black mt-1">{fmt(0)}</h3></div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr><th className="px-6 py-3 text-left">Tax Category</th><th className="px-6 py-3 text-left">Rate</th><th className="px-6 py-3 text-right">Taxable Amount</th><th className="px-6 py-3 text-right">Tax Collected</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[{ cat: "Electronics (GST)", rate: "18%", base: 9000, tax: 1620 }, { cat: "Groceries (GST)", rate: "0%", base: 3200, tax: 0 }, { cat: "Apparel (GST)", rate: "12%", base: 2500, tax: 300 }, { cat: "Health & Beauty (GST)", rate: "12%", base: 1800, tax: 216 }].map(r => (
              <tr key={r.cat} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium">{r.cat}</td>
                <td className="px-6 py-4"><span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold">{r.rate}</span></td>
                <td className="px-6 py-4 text-right font-medium">{fmt(r.base)}</td>
                <td className="px-6 py-4 text-right font-black text-indigo-600">{fmt(r.tax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (view === "shift") return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Shift Report — {posSession.shift} Shift</h2>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold mb-4 border-b pb-3">Shift Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">Cashier</span><span className="font-bold">{posSession.cashier}</span></div>
            <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">Register</span><span className="font-mono bg-slate-100 px-2 rounded">{posSession.registerId}</span></div>
            <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">Shift Start</span><span>{new Date(posSession.openedAt).toLocaleTimeString()}</span></div>
            <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">Opening Float</span><span className="font-bold">{fmt(posSession.openingFloat)}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-500">Duration</span><span className="font-bold text-indigo-600">7h 32m</span></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold mb-4 border-b pb-3">Shift Performance</h3>
          <div className="space-y-3 text-sm">
            {[{ label: "Orders Processed", val: posDashboardStats.todayOrders, fmt: false }, { label: "Revenue Generated", val: posDashboardStats.todayRevenue, fmt: true }, { label: "Refunds Issued", val: posDashboardStats.refundCount, fmt: false }, { label: "Avg. Transaction Value", val: posDashboardStats.avgBill, fmt: true }, { label: "Customers Served", val: posDashboardStats.todayCustomers, fmt: false }].map(m => (
              <div key={m.label} className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">{m.label}</span>
                <span className="font-black text-indigo-700">{m.fmt ? fmt(m.val as number) : m.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Default
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">POS Analytics & Reports</h2>
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border-t-4 border-t-indigo-600 border border-slate-200 shadow-sm"><TrendingUp className="w-6 h-6 text-indigo-600 mb-2" /><p className="text-slate-500 text-sm">Today's Revenue</p><h3 className="text-2xl font-black mt-1">{fmt(posDashboardStats.todayRevenue)}</h3></div>
        <div className="bg-white p-6 rounded-xl border-t-4 border-t-emerald-600 border border-slate-200 shadow-sm"><BarChart3 className="w-6 h-6 text-emerald-600 mb-2" /><p className="text-slate-500 text-sm">Orders</p><h3 className="text-2xl font-black mt-1">{posDashboardStats.todayOrders}</h3></div>
        <div className="bg-white p-6 rounded-xl border-t-4 border-t-amber-500 border border-slate-200 shadow-sm"><Users className="w-6 h-6 text-amber-500 mb-2" /><p className="text-slate-500 text-sm">Customers</p><h3 className="text-2xl font-black mt-1">{posDashboardStats.todayCustomers}</h3></div>
        <div className="bg-white p-6 rounded-xl border-t-4 border-t-rose-500 border border-slate-200 shadow-sm"><ArrowRightLeft className="w-6 h-6 text-rose-500 mb-2" /><p className="text-slate-500 text-sm">Refunds</p><h3 className="text-2xl font-black mt-1 text-rose-600">{fmt(posDashboardStats.refunds)}</h3></div>
      </div>
      <div className="grid grid-cols-3 gap-6">
        {["Daily/Hourly Sales", "Cash Report", "Payment Report", "Tax Report", "Shift Report"].map(r => (
          <div key={r} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 cursor-pointer transition-colors">
            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center mb-3"><BarChart3 className="w-5 h-5 text-indigo-600" /></div>
            <h3 className="font-bold">{r}</h3>
            <p className="text-sm text-slate-500 mt-1">View detailed {r.toLowerCase()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────── AI ASSISTANT ─────────────────── */
function PosAiAssistant() {
  const view = useView();

  const panels: Record<string, { title: string; icon: React.ReactNode; messages: string[]; insights: { label: string; val: string; color: string }[] }> = {
    summary: {
      title: "AI Sales Summary",
      icon: <TrendingUp className="w-5 h-5" />,
      messages: [
        `Today's revenue stands at ${fmt(posDashboardStats.todayRevenue)} across ${posDashboardStats.todayOrders} transactions. This is 12.5% above yesterday's benchmark.`,
        `Top performing category today is Electronics — contributing 48% of total revenue. UPI adoption is up 8% week-on-week.`,
        `Recommend cross-selling Accessories to customers purchasing Electronics — potential uplift of ${fmt(320)} per day.`,
      ],
      insights: [{ label: "Revenue", val: fmt(posDashboardStats.todayRevenue), color: "text-indigo-600" }, { label: "Orders", val: `${posDashboardStats.todayOrders}`, color: "text-emerald-600" }, { label: "Avg. Bill", val: fmt(posDashboardStats.avgBill), color: "text-amber-600" }],
    },
    peak: {
      title: "Peak Hours Prediction",
      icon: <Clock className="w-5 h-5" />,
      messages: [
        "Based on 90-day patterns for this branch, peak hours today will be 12:00–13:30 PM and 5:00–7:00 PM.",
        "Prediction confidence: 91%. Staff accordingly — at least 3 cashiers active during peak windows.",
        "Saturday peak traffic is typically 18% higher than weekdays. Ensure all 3 registers are open by 11:30 AM.",
      ],
      insights: [{ label: "Morning Peak", val: "11am–1pm", color: "text-amber-600" }, { label: "Evening Peak", val: "5pm–7pm", color: "text-rose-600" }, { label: "Confidence", val: "91%", color: "text-emerald-600" }],
    },
    fraud: {
      title: "AI Fraud Detection",
      icon: <ShieldCheck className="w-5 h-5" />,
      messages: [
        "✅ No suspicious patterns detected in the current shift. All transactions appear within normal parameters.",
        "⚠️ 2 void transactions noted at 11:23 AM and 2:47 PM — both authorized by the floor manager. Logged.",
        "Monitoring active: checking for duplicate card swipes, excessive voids, and unusual refund activity in real-time.",
      ],
      insights: [{ label: "Alerts", val: "0 Critical", color: "text-emerald-600" }, { label: "Voids Today", val: "2", color: "text-amber-600" }, { label: "Risk Score", val: "Low", color: "text-emerald-600" }],
    },
    alerts: {
      title: "Inventory Alerts (POS Level)",
      icon: <AlertTriangle className="w-5 h-5" />,
      messages: [
        `🔴 Critical: "${posProducts[0].name}" has only ${posProducts[0].stock} units left. At current sales velocity, estimated stockout in 3.2 hours.`,
        `🟡 Low: "${posProducts[2].name}" — ${posProducts[2].stock} units remaining. Recommend pull from warehouse stock.`,
        `Automatically notified warehouse manager at 2:15 PM for emergency restock of top-10 fast-moving items.`,
      ],
      insights: [{ label: "Critical", val: `${posProducts.filter((p: any) => p.stock < 15).length} SKUs`, color: "text-rose-600" }, { label: "Low Stock", val: `${posProducts.filter((p: any) => p.stock < 30).length} SKUs`, color: "text-amber-600" }, { label: "Healthy", val: `${posProducts.filter((p: any) => p.stock >= 30).length} SKUs`, color: "text-emerald-600" }],
    },
  };

  const panel = panels[view] || panels.summary;
  const defaultMessages = [
    `Hello! I'm your POS AI Copilot. Today's revenue is ${fmt(posDashboardStats.todayRevenue)} across ${posDashboardStats.todayOrders} transactions.`,
    `${posProducts[0].name} is selling 45% faster than last week. Verify floor stock immediately.`,
    "Peak hours prediction: 5:00–7:00 PM. No fraud alerts in the current shift.",
  ];
  const messages = view && panels[view] ? panel.messages : defaultMessages;
  const insights = view && panels[view] ? panel.insights : [{ label: "Revenue", val: fmt(posDashboardStats.todayRevenue), color: "text-indigo-600" }, { label: "Orders", val: `${posDashboardStats.todayOrders}`, color: "text-emerald-600" }, { label: "Status", val: "All OK", color: "text-emerald-600" }];

  return (
    <div className="p-8 flex flex-col h-[calc(100vh-100px)]">
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center"><Sparkles className="w-5 h-5" /></div>
        <div>
          <h2 className="text-2xl font-bold">{view && panels[view] ? panel.title : "POS AI Copilot"}</h2>
          <p className="text-slate-500 text-sm">Powered by LazyMonkeyAI · Realtime</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6 shrink-0">
        {insights.map(ins => (
          <div key={ins.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase mb-1">{ins.label}</p>
            <p className={`text-xl font-black ${ins.color}`}>{ins.val}</p>
          </div>
        ))}
      </div>
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="flex-1 p-6 overflow-y-auto space-y-5">
          {messages.map((msg, i) => (
            <div key={i} className="flex gap-4 max-w-3xl">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5"><Sparkles className="w-4 h-4" /></div>
              <div className="bg-slate-50 p-4 rounded-2xl rounded-tl-sm text-sm text-slate-700 leading-relaxed border border-slate-100">{msg}</div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <div className="relative">
            <input type="text" placeholder="Ask about sales trends, inventory, cashier performance, or fraud alerts..." className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-700"><Sparkles className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── ROUTER ─────────────────── */

const componentMap: Record<string, React.ElementType> = {
  terminal: PosTerminal,
  sales: PosSalesInvoice,
  sales_history: PosInvoicesHistory,
  customers: PosCustomersPlaceholder,
  payment_in: PosPaymentIn,
  devices: PosDevices,
  reports: PosReports,
  ai_assistant: PosAiAssistant,
};

function PosModule() {
  const [, setCurrencyTick] = useState(0);
  useEffect(() => {
    const cb = () => setCurrencyTick(t => t + 1);
    window.addEventListener("bos-currency-changed", cb);
    return () => window.removeEventListener("bos-currency-changed", cb);
  }, []);

  const routerState = useRouterState();
  const searchStr = routerState.location.searchStr;
  const { hasPermission } = useRbac();
  if (!hasPermission("view:pos")) return <Unauthorized />;

  const params = new URLSearchParams(searchStr);
  const activeTab = params.get("tab") || "sales";
  const ActiveComponent = componentMap[activeTab] || PosSalesInvoice;
  const isFullBleed = activeTab === "terminal" || activeTab === "sales";

  return (
    <div className={`flex min-h-full flex-col ${isFullBleed ? "bg-slate-50" : "bg-background"}`}>
      <div className={`flex-1 relative ${isFullBleed ? "" : "bg-background/50 p-3"}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: isFullBleed ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: isFullBleed ? 0 : -10 }}
            transition={{ duration: 0.2 }}
            className="min-h-full"
          >
            <ActiveComponent />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
