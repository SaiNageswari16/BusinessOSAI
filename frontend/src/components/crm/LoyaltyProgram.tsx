import React from "react";
import { motion } from "framer-motion";
import { Gift, Star, Trophy, Target, ArrowUpRight, Plus, Tags, Ticket } from "lucide-react";

import { useCrmData } from "@/hooks/useCrmData";

interface Props {
  tab?: string;
}

export function LoyaltyProgram({ tab = "points_rules" }: Props) {
  const { mockLoyaltyRewards } = useCrmData();
  const rewards = mockLoyaltyRewards;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Loyalty Program</h1>
          <p className="text-sm text-muted-foreground">Manage rewards, points conversion, and customer tiers.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
          <Plus className="size-4" /> Create Reward
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 rounded-xl border border-border/50 relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 size-32 rounded-full blur-3xl bg-amber-500/20 group-hover:bg-amber-500/30 transition-colors" />
          <div className="p-2.5 bg-amber-500/10 rounded-lg w-fit mb-4">
            <Star className="size-5 text-amber-600" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Total Points Issued</p>
          <h3 className="text-3xl font-bold text-foreground">14.5M</h3>
          <p className="text-xs font-medium mt-2 text-emerald-500 flex items-center gap-1">
            <ArrowUpRight className="size-3" /> +1.2M this month
          </p>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-border/50 relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 size-32 rounded-full blur-3xl bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors" />
          <div className="p-2.5 bg-emerald-500/10 rounded-lg w-fit mb-4">
            <Trophy className="size-5 text-emerald-600" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Points Redeemed</p>
          <h3 className="text-3xl font-bold text-foreground">8.2M</h3>
          <p className="text-xs font-medium mt-2 text-muted-foreground">56% redemption rate</p>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-border/50 relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 size-32 rounded-full blur-3xl bg-red-500/20 group-hover:bg-red-500/30 transition-colors" />
          <div className="p-2.5 bg-red-500/10 rounded-lg w-fit mb-4">
            <Target className="size-5 text-red-600" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Points Expired</p>
          <h3 className="text-3xl font-bold text-foreground">450K</h3>
          <p className="text-xs font-medium mt-2 text-red-500 flex items-center gap-1">
            <ArrowUpRight className="size-3" /> +12% vs last month
          </p>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-border/50 relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 size-32 rounded-full blur-3xl bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors" />
          <div className="p-2.5 bg-blue-500/10 rounded-lg w-fit mb-4">
            <Gift className="size-5 text-blue-600" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Active Rewards</p>
          <h3 className="text-3xl font-bold text-foreground">24</h3>
          <p className="text-xs font-medium mt-2 text-muted-foreground">Across all catalogs</p>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-foreground mb-4">Reward Catalog</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {rewards.map((reward, i) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={reward.id}
              className="glass-panel p-5 rounded-xl border border-border/50 hover:border-primary/30 transition-all duration-300 group flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-lg ${
                  reward.type === 'Credit' ? 'bg-emerald-500/10 text-emerald-600' :
                  reward.type === 'Discount' ? 'bg-blue-500/10 text-blue-600' :
                  reward.type === 'Experience' ? 'bg-purple-500/10 text-purple-600' :
                  'bg-amber-500/10 text-amber-600'
                }`}>
                  {reward.type === 'Credit' ? <Trophy className="size-5" /> :
                   reward.type === 'Discount' ? <Tags className="size-5" /> :
                   reward.type === 'Experience' ? <Ticket className="size-5" /> :
                   <Gift className="size-5" />}
                </div>
                <span className="text-xs font-semibold px-2 py-1 bg-muted/50 rounded-md border border-border/50 text-muted-foreground">
                  {reward.type}
                </span>
              </div>
              
              <h3 className="font-semibold text-foreground mb-4 flex-1">{reward.title}</h3>
              
              <div className="bg-background border border-border/50 rounded-lg p-3 mt-auto space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Cost</span>
                  <span className="font-bold text-amber-600 flex items-center gap-1"><Star className="size-3" fill="currentColor" /> {reward.points.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Claims</span>
                  <span className="font-semibold text-sm">{reward.claims.toLocaleString()}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
