import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BedDouble,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ConciergeBell,
  KeyRound,
  Plus,
  Users,
} from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/hotel")({
  head: () => ({
    meta: [
      { title: "Hotel & Hospitality OS — BusinessOS" },
      { name: "description", content: "Room reservations, front desk PMS, housekeeping & guest concierge." },
    ],
  }),
  component: HotelPage,
});

const ROOM_STATUSES = [
  { room: "101 - Deluxe King", guest: "Mr. & Mrs. Anderson", checkOut: "Tomorrow, 11:00 AM", housekeeping: "Clean", status: "Occupied" },
  { room: "102 - Executive Suite", guest: "Dr. Vikram Sethi", checkOut: "24 Oct, 12:00 PM", housekeeping: "Clean", status: "Occupied" },
  { room: "201 - Sea View Penthouse", guest: "Vacant", checkOut: "—", housekeeping: "Inspected & Ready", status: "Available" },
  { room: "202 - Twin Deluxe", guest: "Arrival: Sarah Jenkins (06:00 PM)", checkOut: "26 Oct", housekeeping: "In Progress", status: "Reserved" },
];

function HotelPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="BusinessOS · Integrated Industry Vertical"
        title="Hotel & Hospitality OS"
        description="Property Management System (PMS), keycard provisioning, housekeeping status, room service billing, and banquet booking."
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
            >
              ← Switch Business Portal
            </Link>
            <Button
              onClick={() => toast.success("Front Desk Concierge", { description: "New reservation & check-in flow opened." })}
              className="h-8 gap-1.5 text-xs bg-sky-600 hover:bg-sky-700 text-white"
            >
              <KeyRound className="size-3.5" /> New Guest Check-In
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Room Occupancy" value="84%" delta={6.2} icon={<BedDouble className="text-sky-600" />} />
        <KpiCard label="Arrivals Today" value="18 Guests" delta={0} icon={<Users className="text-sky-600" />} />
        <KpiCard label="RevPAR (Average)" value="₹6,450" delta={11.4} icon={<Building2 className="text-sky-600" />} />
        <KpiCard label="Housekeeping Ready" value="32 of 36" delta={0} icon={<ConciergeBell className="text-sky-600" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Front Desk Room & Key Allocation">
            <div className="divide-y divide-slate-100">
              {ROOM_STATUSES.map((r) => (
                <div key={r.room} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs">
                      <KeyRound className="size-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-slate-900">{r.room}</div>
                      <div className="text-xs text-slate-500">Guest: {r.guest} · Dep: {r.checkOut}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      r.status === "Occupied" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                      r.status === "Available" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                      "bg-sky-50 text-sky-700 border border-sky-200"
                    }`}>
                      {r.status}
                    </span>
                    <div className="text-[11px] text-slate-400 mt-1">{r.housekeeping}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div>
          <Panel title="Guest Concierge Quick Dispatch">
            <div className="space-y-2 text-xs">
              <button
                onClick={() => toast.success("Valet Dispatched")}
                className="w-full text-left p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 font-medium flex justify-between"
              >
                <span>Airport Pickup & Valet</span>
                <span className="text-slate-400">→</span>
              </button>
              <button
                onClick={() => toast.success("Housekeeping Alerted")}
                className="w-full text-left p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 font-medium flex justify-between"
              >
                <span>Express Turn-Down Service</span>
                <span className="text-slate-400">→</span>
              </button>
              <button
                onClick={() => toast.success("Banquet Hall Checked")}
                className="w-full text-left p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 font-medium flex justify-between"
              >
                <span>Grand Ballroom Conference Booking</span>
                <span className="text-slate-400">→</span>
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </PageContainer>
  );
}
