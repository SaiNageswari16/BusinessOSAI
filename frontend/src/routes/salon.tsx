import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Heart,
  Plus,
  Scissors,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/salon")({
  head: () => ({
    meta: [
      { title: "Salon & Spa OS — BusinessOS" },
      { name: "description", content: "Stylist chair rosters, appointment booking & client treatments." },
    ],
  }),
  component: SalonPage,
});

const STYLISTS = [
  { id: "s1", name: "Elena Rostova", specialty: "Master Hair Colorist", chairs: "Chair #1", status: "In Service", clientsToday: 6, rating: 4.9 },
  { id: "s2", name: "Marcus Vance", specialty: "Creative Fade & Beard", chairs: "Chair #2", status: "Available", clientsToday: 4, rating: 4.8 },
  { id: "s3", name: "Aria Thorne", specialty: "Organic Spa & Facial", chairs: "Suite A", status: "In Service", clientsToday: 5, rating: 5.0 },
  { id: "s4", name: "Chloe Dupont", specialty: "Keratin & Botanical Hair Spa", chairs: "Chair #3", status: "On Break", clientsToday: 3, rating: 4.9 },
];

const APPOINTMENTS = [
  { id: "apt-101", time: "04:30 PM", client: "Sophia Bennett", service: "Balayage Highlights + Blowdry", stylist: "Elena Rostova", duration: "90m", amount: "₹4,800", status: "Active" },
  { id: "apt-102", time: "05:00 PM", client: "David Miller", service: "Deluxe Hot Towel Beard Grooming", stylist: "Marcus Vance", duration: "45m", amount: "₹1,250", status: "Confirmed" },
  { id: "apt-103", time: "05:30 PM", client: "Aanya Sharma", service: "Hydra-Luxe Glow Facial & Peel", stylist: "Aria Thorne", duration: "60m", amount: "₹3,400", status: "Confirmed" },
  { id: "apt-104", time: "06:15 PM", client: "Kavita Rao", service: "Deep Hydration Moroccan Spa", stylist: "Chloe Dupont", duration: "75m", amount: "₹2,900", status: "Waitlist" },
];

function SalonPage() {
  const [activeTab, setActiveTab] = useState<"appointments" | "stylists" | "treatments">("appointments");

  return (
    <PageContainer>
      <PageHeader
        eyebrow="BusinessOS · Integrated Industry Vertical"
        title="Salon & Spa OS"
        description="Real-time chair occupancy, appointments calendar, stylist commissions, and client treatment regimens."
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
            >
              ← Switch Business Portal
            </Link>
            <Button
              onClick={() => toast.success("Appointment modal opened", { description: "Book walk-in or phone reservation." })}
              className="h-8 gap-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white"
            >
              <Plus className="size-3.5" /> Book Appointment
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Today's Bookings" value="28" delta={16.4} icon={<Calendar className="text-violet-600" />} />
        <KpiCard label="Chair Occupancy" value="78%" delta={8.2} icon={<Scissors className="text-violet-600" />} />
        <KpiCard label="Service Revenue" value="₹64,250" delta={12.5} icon={<DollarSign className="text-violet-600" />} />
        <KpiCard label="Active Stylists" value="4 on floor" delta={0} icon={<Users className="text-violet-600" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Appointment Board */}
        <div className="lg:col-span-2 space-y-4">
          <Panel
            title="Live Appointment Schedule"
            action={
              <div className="flex gap-1 text-xs">
                <button
                  onClick={() => setActiveTab("appointments")}
                  className={`px-2.5 py-1 rounded font-medium ${activeTab === "appointments" ? "bg-violet-100 text-violet-700" : "text-slate-500"}`}
                >
                  Schedule
                </button>
                <button
                  onClick={() => setActiveTab("stylists")}
                  className={`px-2.5 py-1 rounded font-medium ${activeTab === "stylists" ? "bg-violet-100 text-violet-700" : "text-slate-500"}`}
                >
                  Stylists
                </button>
              </div>
            }
          >
            <div className="divide-y divide-slate-100">
              {APPOINTMENTS.map((apt) => (
                <div key={apt.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-violet-50 text-violet-600 font-mono text-xs font-bold flex flex-col items-center justify-center">
                      <Clock className="size-3.5 mb-0.5" />
                      {apt.time.split(" ")[0]}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-slate-900">{apt.client}</div>
                      <div className="text-xs text-slate-500">{apt.service} · {apt.duration}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm text-slate-900">{apt.amount}</div>
                    <div className="text-xs text-violet-600 font-medium">{apt.stylist}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Stylist Chairs Status */}
        <div className="space-y-4">
          <Panel title="Stylist Chairs & Stations">
            <div className="space-y-3">
              {STYLISTS.map((s) => (
                <div key={s.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                      {s.name}
                      <span className="text-[10px] text-amber-500 font-bold flex items-center gap-0.5">
                        <Star className="size-2.5 fill-current" /> {s.rating}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">{s.chairs} · {s.specialty}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    s.status === "In Service" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                    s.status === "Available" ? "bg-sky-50 text-sky-700 border border-sky-200" : "bg-slate-100 text-slate-600"
                  }`}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </PageContainer>
  );
}
