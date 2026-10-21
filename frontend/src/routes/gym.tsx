import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  CheckCircle2,
  Dumbbell,
  Flame,
  Plus,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/gym")({
  head: () => ({
    meta: [
      { title: "Gym & Fitness OS — BusinessOS" },
      { name: "description", content: "Turnstiles access, trainer sessions, member subscriptions & floor capacity." },
    ],
  }),
  component: GymPage,
});

const CHECK_INS = [
  { id: "c1", member: "Rohan Varma", plan: "Black Platinum Annual", time: "2m ago", turnstile: "Main Gate #1", trainer: "Personal: Alex", status: "Active Workout" },
  { id: "c2", member: "Ananya Iyer", plan: "HIIT & CrossFit Monthly", time: "8m ago", turnstile: "CrossFit Zone #2", trainer: "Coach Priya", status: "Class: Iron Core" },
  { id: "c3", member: "Siddharth Malhotra", plan: "Strength & Conditioning", time: "14m ago", turnstile: "Turnstile #3", trainer: "Self-Guided", status: "Active Workout" },
  { id: "c4", member: "Natasha Roy", plan: "Pilates Reformer Pass", time: "22m ago", turnstile: "Studio Turnstile", trainer: "Elena", status: "Studio Session" },
];

function GymPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="BusinessOS · Integrated Industry Vertical"
        title="Gym & Fitness OS"
        description="Live biometric turnstiles, trainer schedule booking, locker assignments, and membership subscriptions."
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
            >
              ← Switch Business Portal
            </Link>
            <Button
              onClick={() => toast.success("RFID Scanner Ready", { description: "Tap member NFC card or QR token." })}
              className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <UserCheck className="size-3.5" /> Scan Member Pass
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Currently on Floor" value="84" delta={12.1} icon={<Users className="text-emerald-600" />} />
        <KpiCard label="Floor Capacity" value="62%" delta={4.5} icon={<Activity className="text-emerald-600" />} />
        <KpiCard label="Active Subscriptions" value="1,240" delta={9.8} icon={<ShieldCheck className="text-emerald-600" />} />
        <KpiCard label="Classes Today" value="12 sessions" delta={0} icon={<Flame className="text-emerald-600" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Live Turnstile RFID Check-In Feed">
            <div className="divide-y divide-slate-100">
              {CHECK_INS.map((c) => (
                <div key={c.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                      <Dumbbell className="size-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-slate-900">{c.member}</div>
                      <div className="text-xs text-slate-500">{c.plan} · {c.turnstile}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {c.status}
                    </span>
                    <div className="text-[11px] text-slate-400 mt-1">{c.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div>
          <Panel title="Floor Zones & Peak Load">
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between font-medium text-slate-700 mb-1">
                  <span>Free Weights & Heavy Racks</span>
                  <span className="font-bold text-emerald-700">82% Load</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-emerald-600 rounded-full w-[82%]" />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-medium text-slate-700 mb-1">
                  <span>Cardio Deck & Treadmills</span>
                  <span className="font-bold text-emerald-700">54% Load</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-[54%]" />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-medium text-slate-700 mb-1">
                  <span>Spinning & HIIT Studio</span>
                  <span className="font-bold text-amber-600">Full (Class On)</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full w-[100%]" />
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </PageContainer>
  );
}
