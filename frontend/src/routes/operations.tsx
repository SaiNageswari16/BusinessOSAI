import { useState, useMemo, useEffect, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Armchair,
  ArrowRight,
  ArrowRightLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  DollarSign,
  Edit3,
  Layers,
  LayoutGrid,
  Lock,
  Map as MapIcon,
  Move,
  Palette,
  Phone,
  Plus,
  Receipt,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  Utensils,
  Wallet,
  Wand2,
  X,
} from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCustomers,
  useOrders,
  useReservations,
  useSettings,
  seatTable as storeSeatTable,
  setTableStatus as storeSetTableStatus,
  settleOrder as storeSettleOrder,
  transferTable as storeTransferTable,
  reserveTable as storeReserveTable,
  addTable as storeAddTable,
  updateTable as storeUpdateTable,
  deleteTable as storeDeleteTable,
} from "@/services/orderService";
import { organizationService } from "@/services/organizationService";
import { computeBill, orderTotal } from "@/lib/billing";
import { money } from "@/lib/format";
import type { PaymentMethod, RestaurantTable, TableShape, TableStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ReceiptDialog } from "@/components/common/ReceiptDialog";

export const Route = createFileRoute("/operations")({
  head: () => ({
    meta: [
      { title: "Operations & Floor Plan — RestaurantOS" },
      {
        name: "description",
        content:
          "Live real-time floor plan connected directly to PostgreSQL microservice. Petpooja table management with round, square, rectangle, and L-booth arrangements.",
      },
    ],
  }),
  component: OperationsPage,
});

type BlueprintTheme =
  | "blueprint"
  | "dark_oak"
  | "slate_stone"
  | "terrace_garden"
  | "neon_lounge"
  | "banquet_gold";

type BlueprintLayout = "perimeter" | "grid" | "cluster" | "diagonal";

const BLUEPRINT_THEMES: Record<
  BlueprintTheme,
  {
    name: string;
    description: string;
    containerClass: string;
    canvasBgStyle: React.CSSProperties;
    accentColor: string;
    badgeStyle: string;
    label: string;
    icon: string;
  }
> = {
  blueprint: {
    name: "Architectural CAD Blueprint",
    description: "Classic blueprint navy with technical cyan grid & dimensions",
    containerClass: "bg-[#091528] border-sky-500/40 text-sky-100",
    canvasBgStyle: {
      backgroundColor: "#071324",
      backgroundImage: `
        linear-gradient(rgba(56, 189, 248, 0.15) 1px, transparent 1px),
        linear-gradient(90deg, rgba(56, 189, 248, 0.15) 1px, transparent 1px),
        linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px)
      `,
      backgroundSize: "64px 64px, 64px 64px, 16px 16px, 16px 16px",
    },
    accentColor: "#38bdf8",
    badgeStyle: "bg-sky-950/80 text-sky-300 border border-sky-700/50",
    label: "CAD Blueprint",
    icon: "📐",
  },
  dark_oak: {
    name: "Luxury Dark Oak Hardwood",
    description: "Rich mahogany wood planks with warm ambient dining lighting",
    containerClass: "bg-[#180f09] border-amber-800/60 text-amber-100",
    canvasBgStyle: {
      backgroundColor: "#140c07",
      backgroundImage: `
        repeating-linear-gradient(0deg, rgba(217, 119, 6, 0.08) 0px, rgba(217, 119, 6, 0.08) 2px, transparent 2px, transparent 36px),
        repeating-linear-gradient(90deg, rgba(217, 119, 6, 0.05) 0px, rgba(217, 119, 6, 0.05) 2px, transparent 2px, transparent 72px)
      `,
    },
    accentColor: "#f59e0b",
    badgeStyle: "bg-amber-950/80 text-amber-300 border border-amber-800/60",
    label: "Dark Oak Parquet",
    icon: "🪵",
  },
  slate_stone: {
    name: "Modern Slate & Terrazzo",
    description: "Cool minimalist stone tile pavers for clean contemporary dining",
    containerClass: "bg-slate-900 border-slate-700 text-slate-100",
    canvasBgStyle: {
      backgroundColor: "#0b1120",
      backgroundImage: `
        linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(148, 163, 184, 0.1) 1px, transparent 1px)
      `,
      backgroundSize: "32px 32px",
    },
    accentColor: "#94a3b8",
    badgeStyle: "bg-slate-800 text-slate-200 border border-slate-700",
    label: "Slate Terrazzo",
    icon: "🪨",
  },
  terrace_garden: {
    name: "Open-Air Sky Terrace & Patio",
    description: "Cobblestone pavers with lush planters & outdoor parasols",
    containerClass: "bg-[#091a13] border-emerald-800 text-emerald-100",
    canvasBgStyle: {
      backgroundColor: "#05140e",
      backgroundImage: `
        radial-gradient(rgba(16, 185, 129, 0.18) 1.5px, transparent 1.5px),
        radial-gradient(rgba(52, 211, 153, 0.09) 1.5px, transparent 1.5px)
      `,
      backgroundSize: "28px 28px, 14px 14px",
      backgroundPosition: "0 0, 7px 7px",
    },
    accentColor: "#10b981",
    badgeStyle: "bg-emerald-950/80 text-emerald-300 border border-emerald-800",
    label: "Garden Patio",
    icon: "🌿",
  },
  neon_lounge: {
    name: "Neon Speakeasy & Sky Lounge",
    description: "Deep obsidian with purple/cyan perimeter glow & cocktail bar accents",
    containerClass: "bg-[#0d061a] border-purple-800 text-purple-100",
    canvasBgStyle: {
      backgroundColor: "#080312",
      backgroundImage: `
        radial-gradient(ellipse at 50% 50%, rgba(168, 85, 247, 0.14), transparent 70%),
        linear-gradient(rgba(192, 132, 252, 0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(192, 132, 252, 0.1) 1px, transparent 1px)
      `,
      backgroundSize: "100% 100%, 48px 48px, 48px 48px",
    },
    accentColor: "#c084fc",
    badgeStyle: "bg-purple-950/80 text-purple-300 border border-purple-800",
    label: "Neon Lounge",
    icon: "🍸",
  },
  banquet_gold: {
    name: "Grand Ballroom & Royal Banquet",
    description: "Deep burgundy & gold carpet motif for luxury functions",
    containerClass: "bg-[#1c0910] border-rose-900 text-rose-100",
    canvasBgStyle: {
      backgroundColor: "#13050a",
      backgroundImage: `
        radial-gradient(circle, rgba(244, 63, 94, 0.12) 2px, transparent 2px),
        linear-gradient(rgba(245, 158, 11, 0.08) 1px, transparent 1px),
        linear-gradient(90deg, rgba(245, 158, 11, 0.08) 1px, transparent 1px)
      `,
      backgroundSize: "40px 40px, 80px 80px, 80px 80px",
    },
    accentColor: "#fbbf24",
    badgeStyle: "bg-rose-950/80 text-amber-200 border border-rose-900",
    label: "Grand Banquet",
    icon: "🍷",
  },
};

function calculateBatchPositions(
  count: number,
  layout: BlueprintLayout
): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  if (layout === "grid") {
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const startX = 22;
    const endX = 78;
    const startY = 26;
    const endY = 74;
    const stepX = cols > 1 ? (endX - startX) / (cols - 1) : 0;
    const stepY = rows > 1 ? (endY - startY) / (rows - 1) : 0;
    for (let i = 0; i < count; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      positions.push({
        x: Math.round(startX + c * stepX),
        y: Math.round(startY + r * stepY),
      });
    }
  } else if (layout === "perimeter") {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
      const rx = 34;
      const ry = 28;
      positions.push({
        x: Math.round(50 + rx * Math.cos(angle)),
        y: Math.round(50 + ry * Math.sin(angle)),
      });
    }
  } else if (layout === "cluster") {
    const cols = Math.min(count, 4);
    const rows = Math.ceil(count / cols);
    const stepX = 15;
    const stepY = 20;
    const startX = 50 - ((cols - 1) * stepX) / 2;
    const startY = 50 - ((rows - 1) * stepY) / 2;
    for (let i = 0; i < count; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      positions.push({
        x: Math.round(startX + c * stepX),
        y: Math.round(startY + r * stepY),
      });
    }
  } else {
    // diagonal stagger
    const step = 56 / (count + 1);
    for (let i = 0; i < count; i++) {
      const progress = (i + 1) * step;
      const zigzag = i % 2 === 0 ? -10 : 10;
      positions.push({
        x: Math.round(22 + progress + zigzag),
        y: Math.round(22 + progress - zigzag),
      });
    }
  }
  return positions;
}

const statusColors: Record<
  TableStatus,
  { bg: string; border: string; text: string; ring: string }
> = {
  Available: {
    bg: "bg-emerald-50/80",
    border: "border-emerald-300",
    text: "text-emerald-800",
    ring: "ring-emerald-400/30",
  },
  Occupied: {
    bg: "bg-sky-50/90",
    border: "border-sky-400",
    text: "text-sky-800",
    ring: "ring-sky-400/40",
  },
  Billing: {
    bg: "bg-amber-50/90",
    border: "border-amber-400",
    text: "text-amber-800",
    ring: "ring-amber-400/40",
  },
  Reserved: {
    bg: "bg-purple-50/85",
    border: "border-purple-300",
    text: "text-purple-800",
    ring: "ring-purple-400/30",
  },
  Cleaning: {
    bg: "bg-slate-100",
    border: "border-slate-300",
    text: "text-slate-700",
    ring: "ring-slate-300",
  },
};

const toBackendStatus = (
  s: TableStatus
): "free" | "occupied" | "reserved" | "billing" | "cleaning" | "blocked" => {
  switch (s) {
    case "Available":
      return "free";
    case "Occupied":
      return "occupied";
    case "Billing":
      return "billing";
    case "Reserved":
      return "reserved";
    case "Cleaning":
      return "cleaning";
    default:
      return "free";
  }
};

const toFrontendStatus = (s: string): TableStatus => {
  switch (s?.toLowerCase()) {
    case "free":
    case "available":
      return "Available";
    case "occupied":
      return "Occupied";
    case "billing":
    case "billed":
      return "Billing";
    case "reserved":
      return "Reserved";
    case "cleaning":
    case "dirty":
      return "Cleaning";
    default:
      return "Available";
  }
};

function OperationsPage() {
  const navigate = useNavigate();
  const orders = useOrders();
  const settings = useSettings();

  // Live state from PostgreSQL Backend
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [sections, setSections] = useState<
    { id: string; name: string; section_type: string; capacity: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  // View mode
  const [viewMode, setViewMode] = useState<"live" | "builder">("live");
  const [displayType, setDisplayType] = useState<"canvas" | "grid">("canvas");
  const [selectedArea, setSelectedArea] = useState<string>("All");

  // Selected table for Petpooja Action Drawer
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  // Modals state
  const [addTableOpen, setAddTableOpen] = useState(false);
  const [editTableOpen, setEditTableOpen] = useState(false);
  const [seatModalOpen, setSeatModalOpen] = useState(false);
  const [reserveModalOpen, setReserveModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [payPickerOpen, setPayPickerOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [activePaymentMethod, setActivePaymentMethod] = useState<PaymentMethod>("UPI");

  // Seating form state
  const [seatGuestCount, setSeatGuestCount] = useState(2);
  const [seatCustomerName, setSeatCustomerName] = useState("Walk-in Guest");
  const [seatCustomerPhone, setSeatCustomerPhone] = useState("");
  const [seatWaiter, setSeatWaiter] = useState("Ravi");

  // Reservation form state
  const [resCustomerName, setResCustomerName] = useState("");
  const [resCustomerPhone, setResCustomerPhone] = useState("");
  const [resCovers, setResCovers] = useState(4);
  const [resTime, setResTime] = useState("07:30 PM");

  // Table transfer state
  const [targetTransferTableId, setTargetTransferTableId] = useState("");

  // Add / Edit Table Form state
  const [formTableId, setFormTableId] = useState("");
  const [formTableName, setFormTableName] = useState("");
  const [formSectionId, setFormSectionId] = useState("");
  const [formSeats, setFormSeats] = useState(4);
  const [formShape, setFormShape] = useState<TableShape>("round");
  const [formPosX, setFormPosX] = useState(50);
  const [formPosY, setFormPosY] = useState(50);

  // ── Fetch Live PostgreSQL Data via Organization Service API ──
  const refreshLiveTables = async () => {
    try {
      setLoading(true);
      const [backendTables, backendSections] = await Promise.all([
        organizationService.getTables(),
        organizationService.getSections().catch(() => []),
      ]);

      setSections(backendSections);

      // Section lookup map
      const secMap = new Map<string, string>();
      backendSections.forEach((s) => secMap.set(s.id, s.name));

      const mapped: RestaurantTable[] = (backendTables as any[]).map((t) => {
        const areaName = (t.section_id && secMap.get(t.section_id)) || "Main Hall";
        return {
          id: t.code || t.name || t.id,
          backendId: t.id ? String(t.id) : undefined,
          name: t.name || `Table ${t.code}`,
          code: t.code,
          area: areaName,
          seats: Number(t.seats || t.capacity || 4),
          shape: (t.shape as TableShape) || "round",
          status: toFrontendStatus(t.status),
          posX: t.position_x !== null && t.position_x !== undefined ? Number(t.position_x) : 50,
          posY: t.position_y !== null && t.position_y !== undefined ? Number(t.position_y) : 50,
          customerName: t.status === "occupied" ? "Active Guest" : undefined,
          seatedMins: t.status === "occupied" ? 25 : undefined,
          waiter: "Ravi",
        };
      });

      setTables(mapped);
    } catch (err) {
      console.error("Failed to load tables from backend API:", err);
      toast.error("Failed to fetch live tables from PostgreSQL database");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshLiveTables();
  }, []);

  // ── Floor & Blueprint Management State ──
  const [floorThemes, setFloorThemes] = useState<Record<string, BlueprintTheme>>(() => {
    if (typeof localStorage !== "undefined") {
      try {
        const stored = localStorage.getItem("ros-floor-themes");
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return {
      "Main Dining": "dark_oak",
      "Terrace": "terrace_garden",
      "Rooftop": "neon_lounge",
      "Banquet": "banquet_gold",
      "AC Hall": "dark_oak",
    };
  });

  const saveFloorTheme = (floor: string, theme: BlueprintTheme) => {
    setFloorThemes((prev) => {
      const updated = { ...prev, [floor]: theme };
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("ros-floor-themes", JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Add Floor Modal State
  const [addFloorOpen, setAddFloorOpen] = useState(false);
  const [newFloorName, setNewFloorName] = useState("");
  const [newFloorType, setNewFloorType] = useState("ac_hall");
  const [newFloorCapacity, setNewFloorCapacity] = useState(50);
  const [newFloorTheme, setNewFloorTheme] = useState<BlueprintTheme>("blueprint");
  const [newFloorAutoTables, setNewFloorAutoTables] = useState(true);
  const [newFloorTableCount, setNewFloorTableCount] = useState(6);
  const [newFloorPrefix, setNewFloorPrefix] = useState("R-");
  const [newFloorShape, setNewFloorShape] = useState<TableShape>("round");
  const [newFloorLayout, setNewFloorLayout] = useState<BlueprintLayout>("perimeter");

  // Batch Table Sequencer Modal State
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchFloorName, setBatchFloorName] = useState("");
  const [batchCount, setBatchCount] = useState(6);
  const [batchPrefix, setBatchPrefix] = useState("T-");
  const [batchStartNum, setBatchStartNum] = useState(1);
  const [batchSeats, setBatchSeats] = useState(4);
  const [batchShape, setBatchShape] = useState<TableShape>("round");
  const [batchLayout, setBatchLayout] = useState<BlueprintLayout>("grid");

  // ── Handlers for Floor Management ──
  const handleCreateFloor = async () => {
    if (!newFloorName.trim()) {
      toast.error("Please enter a floor / section name");
      return;
    }

    try {
      setLoading(true);
      const createdSection = await organizationService.createSection({
        name: newFloorName.trim(),
        section_type: newFloorType,
        capacity: Number(newFloorCapacity) || 40,
        sort_order: sections.length + 1,
      });

      saveFloorTheme(createdSection.name, newFloorTheme);

      if (newFloorAutoTables && newFloorTableCount > 0) {
        const positions = calculateBatchPositions(newFloorTableCount, newFloorLayout);
        const prefix = newFloorPrefix.trim().toUpperCase() || "T-";

        for (let i = 0; i < positions.length; i++) {
          const pos = positions[i];
          const tableCode = `${prefix}${i + 1}`;
          try {
            await organizationService.createTable({
              outlet_id: "11111111-2222-3333-4444-555555555555",
              name: `Table ${tableCode}`,
              code: tableCode,
              seats: 4,
              shape: newFloorShape,
              section_id: createdSection.id,
              position_x: pos.x,
              position_y: pos.y,
            });
          } catch (e) {
            console.warn("Table create clash / error:", e);
          }
        }
      }

      toast.success(
        `Floor "${createdSection.name}" created in PostgreSQL with ${
          newFloorAutoTables ? newFloorTableCount : 0
        } blueprint tables!`
      );
      setAddFloorOpen(false);
      setSelectedArea(createdSection.name);
      await refreshLiveTables();
    } catch (err: any) {
      console.error("Failed to create floor:", err);
      toast.error(`Backend Error: ${err?.message || "Failed to create floor in database"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchGenerateTables = async () => {
    const targetSection = sections.find((s) => s.name === batchFloorName) || sections[0];
    if (!targetSection) {
      toast.error("Please select a valid floor");
      return;
    }

    try {
      setLoading(true);
      const positions = calculateBatchPositions(batchCount, batchLayout);
      const prefix = batchPrefix.trim().toUpperCase() || "T-";

      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        const num = batchStartNum + i;
        const tableCode = `${prefix}${num}`;
        try {
          await organizationService.createTable({
            outlet_id: "11111111-2222-3333-4444-555555555555",
            name: `Table ${tableCode}`,
            code: tableCode,
            seats: Number(batchSeats) || 4,
            shape: batchShape,
            section_id: targetSection.id,
            position_x: pos.x,
            position_y: pos.y,
          });
        } catch (e) {
          console.warn("Table create clash / error:", e);
        }
      }

      toast.success(
        `Auto-sequenced ${batchCount} tables (${prefix}${batchStartNum}..${prefix}${
          batchStartNum + batchCount - 1
        }) on floor "${targetSection.name}" in PostgreSQL!`
      );
      setBatchModalOpen(false);
      await refreshLiveTables();
    } catch (err: any) {
      console.error("Failed to batch create tables:", err);
      toast.error(`Backend Error: ${err?.message || "Failed to generate tables in database"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFloor = async (sectionName: string) => {
    const targetSection = sections.find((s) => s.name === sectionName);
    if (!targetSection) return;

    const floorTables = tables.filter((t) => t.area === sectionName);
    if (
      !confirm(
        `Are you sure you want to delete floor "${sectionName}"? It contains ${floorTables.length} tables in PostgreSQL.`
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      for (const t of floorTables) {
        try {
          await organizationService.deleteTable(t.backendId || t.id);
        } catch {}
      }
      await organizationService.deleteSection(targetSection.id);
      toast.success(`Floor "${sectionName}" deleted from PostgreSQL database`);
      setSelectedArea("All");
      await refreshLiveTables();
    } catch (err: any) {
      console.error("Failed to delete floor:", err);
      toast.error(`Backend Error: ${err?.message || "Failed to delete floor from database"}`);
    } finally {
      setLoading(false);
    }
  };

  // Distinct dining areas / sections combining backend sections and active tables
  const areas = useMemo(() => {
    const fromSec = sections.map((s) => s.name);
    const fromTab = tables.map((t) => t.area);
    const distinct = Array.from(new Set([...fromSec, ...fromTab])).filter(Boolean);
    return ["All", ...distinct];
  }, [sections, tables]);

  const activeTable = tables.find((x) => x.id === selectedTableId);
  const activeOrder = activeTable?.orderId
    ? orders.find((o) => o.id === activeTable.orderId)
    : undefined;

  const countByStatus = (s: TableStatus) => tables.filter((x) => x.status === s).length;

  const orderBill = activeOrder
    ? computeBill(activeOrder.lines, {
        taxRate: settings.taxRate,
        serviceCharge: settings.serviceCharge,
        discountPct: 0,
        dineIn: true,
      })
    : null;

  // Open Seating Modal for a Table
  const openSeatDialog = (table: RestaurantTable) => {
    setSelectedTableId(table.id);
    setSeatGuestCount(table.seats);
    setSeatCustomerName(table.customerName || "Walk-in Guest");
    setSeatCustomerPhone(table.customerPhone || "");
    setSeatModalOpen(true);
  };

  const handleSeatSubmit = async (jumpToPos = false) => {
    if (!selectedTableId) return;

    try {
      const target = tables.find((t) => t.id === selectedTableId);
      await organizationService.setTableStatus(target?.backendId || selectedTableId, "occupied");

      setTables((prev) =>
        prev.map((t) =>
          t.id === selectedTableId
            ? {
                ...t,
                status: "Occupied",
                guests: seatGuestCount,
                customerName: seatCustomerName.trim() || "Walk-in Guest",
                customerPhone: seatCustomerPhone.trim(),
                seatedMins: 0,
                waiter: seatWaiter,
              }
            : t
        )
      );

      storeSeatTable(
        selectedTableId,
        seatGuestCount,
        seatCustomerName.trim() || "Walk-in Guest",
        seatWaiter,
        seatCustomerPhone.trim()
      );

      toast.success(`Table ${selectedTableId} marked Running in PostgreSQL with ${seatGuestCount} covers`);
      setSeatModalOpen(false);
      if (jumpToPos) {
        navigate({ to: "/pos" });
      }
    } catch (err: any) {
      console.error("Failed to seat table in backend:", err);
      toast.error(`Backend Error: ${err?.message || "Failed to update table status in database"}`);
    }
  };

  // Open Reservation Modal
  const openReserveDialog = (table: RestaurantTable) => {
    setSelectedTableId(table.id);
    setResCustomerName("");
    setResCustomerPhone("");
    setResCovers(table.seats);
    setResTime("08:00 PM");
    setReserveModalOpen(true);
  };

  const handleReserveSubmit = async () => {
    if (!selectedTableId || !resCustomerName) {
      toast.error("Please enter guest name");
      return;
    }

    try {
      const target = tables.find((t) => t.id === selectedTableId);
      await organizationService.setTableStatus(target?.backendId || selectedTableId, "reserved");

      setTables((prev) =>
        prev.map((t) =>
          t.id === selectedTableId
            ? {
                ...t,
                status: "Reserved",
                guests: resCovers,
                customerName: resCustomerName.trim(),
                customerPhone: resCustomerPhone.trim(),
              }
            : t
        )
      );

      storeReserveTable(
        selectedTableId,
        resCustomerName.trim(),
        resCovers,
        resTime,
        resCustomerPhone.trim()
      );

      toast.success(`Table ${selectedTableId} reserved in PostgreSQL for ${resCustomerName} at ${resTime}`);
      setReserveModalOpen(false);
    } catch (err: any) {
      console.error("Failed to reserve table:", err);
      toast.error(`Backend Error: ${err?.message || "Failed to reserve table in database"}`);
    }
  };

  // Open Table Transfer Modal (Petpooja Shift Table)
  const openTransferDialog = (table: RestaurantTable) => {
    setSelectedTableId(table.id);
    const availableTables = tables.filter((t) => t.id !== table.id && t.status === "Available");
    if (availableTables.length > 0) {
      setTargetTransferTableId(availableTables[0].id);
    }
    setTransferModalOpen(true);
  };

  const handleTransferSubmit = async () => {
    if (!selectedTableId || !targetTransferTableId) return;

    try {
      const sourceTable = tables.find((t) => t.id === selectedTableId);
      const destTable = tables.find((t) => t.id === targetTransferTableId);
      await Promise.all([
        organizationService.setTableStatus(sourceTable?.backendId || selectedTableId, "dirty"),
        organizationService.setTableStatus(destTable?.backendId || targetTransferTableId, "occupied"),
      ]);

      storeTransferTable(selectedTableId, targetTransferTableId);
      toast.success(`Table Shifted: Moved orders from ${selectedTableId} to ${targetTransferTableId}`);
      setTransferModalOpen(false);
      setSelectedTableId(targetTransferTableId);
      refreshLiveTables();
    } catch (err: any) {
      console.error("Failed to transfer table in backend:", err);
      toast.error(`Backend Error: ${err?.message || "Failed to shift table in database"}`);
    }
  };

  // Floor Plan: Add New Table
  const handleAddNewTable = async () => {
    const tableCode = formTableId.trim().toUpperCase() || `T${tables.length + 1}`;
    const tableName = formTableName.trim() || `Table ${tableCode}`;

    try {
      await organizationService.createTable({
        outlet_id: "11111111-2222-3333-4444-555555555555",
        name: tableName,
        code: tableCode,
        seats: Number(formSeats) || 4,
        shape: formShape,
        section_id: formSectionId || (sections[0]?.id ?? undefined),
        position_x: Number(formPosX),
        position_y: Number(formPosY),
      });

      toast.success(`Persisted new ${formShape} table: ${tableCode} to PostgreSQL database`);
      setAddTableOpen(false);
      refreshLiveTables();
    } catch (err: any) {
      console.error("Failed to add table in backend:", err);
      toast.error(`Backend Error: ${err?.message || "Failed to persist table to database"}`);
    }
  };

  // Floor Plan: Edit Existing Table
  const openEditDialog = (t: RestaurantTable) => {
    setFormTableId(t.id);
    setFormTableName(t.name || `Table ${t.id}`);
    setFormSeats(t.seats);
    setFormShape(t.shape || "round");
    setFormPosX(t.posX ?? 50);
    setFormPosY(t.posY ?? 50);
    setEditTableOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!formTableId) return;
    try {
      const target = tables.find((t) => t.id === formTableId);
      await organizationService.updateTable(target?.backendId || formTableId, {
        name: formTableName.trim() || `Table ${formTableId}`,
        seats: Number(formSeats) || 4,
        shape: formShape,
        position_x: Number(formPosX),
        position_y: Number(formPosY),
      });
      toast.success(`Updated table ${formTableId} in PostgreSQL database`);
      setEditTableOpen(false);
      refreshLiveTables();
    } catch (err: any) {
      console.error("Failed to update table:", err);
      toast.error(`Backend Error: ${err?.message || "Failed to update table in database"}`);
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    try {
      const target = tables.find((t) => t.id === tableId);
      await organizationService.deleteTable(target?.backendId || tableId);
      toast.success(`Deleted table ${tableId} from PostgreSQL`);
      setEditTableOpen(false);
      setSelectedTableId(null);
      refreshLiveTables();
    } catch (err: any) {
      console.error("Failed to delete table:", err);
      toast.error(`Backend Error: ${err?.message || "Failed to delete table from database"}`);
    }
  };

  const handleStatusChange = async (tableId: string, status: TableStatus) => {
    try {
      const target = tables.find((t) => t.id === tableId);
      await organizationService.setTableStatus(target?.backendId || tableId, toBackendStatus(status));
      setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, status } : t)));
      storeSetTableStatus(tableId, status);
      toast.success(`Table ${tableId} marked ${status} in PostgreSQL`);
    } catch (err: any) {
      console.error("Failed to change status in backend:", err);
      toast.error(`Backend Error: ${err?.message || "Failed to update status in database"}`);
    }
  };

  // Filtered tables for current section view
  const visibleTables = useMemo(() => {
    return tables.filter((t) => selectedArea === "All" || t.area === selectedArea);
  }, [tables, selectedArea]);

  return (
    <PageContainer>
      {/* ── Top Header & Actions ── */}
      <PageHeader
        eyebrow="Dining Operations & Floor Canvas"
        title="Floor Operations & Real-Time Tables"
        description="Petpooja-standard table management connected live to PostgreSQL microservice (:8101 via :8000). Visual table layouts (round, square, rectangle, L-booths), seating, and table shifts."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle: Live vs Builder */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 shadow-2xs">
              <button
                onClick={() => setViewMode("live")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition",
                  viewMode === "live"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Utensils className="size-3.5" /> Live Service
              </button>
              <button
                onClick={() => setViewMode("builder")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition",
                  viewMode === "builder"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Layers className="size-3.5" /> Floor Plan Builder
              </button>
            </div>

            {/* Canvas vs Grid Toggle */}
            <div className="hidden sm:flex items-center rounded-lg border border-slate-200 bg-white p-1 shadow-2xs">
              <button
                onClick={() => setDisplayType("canvas")}
                className={cn(
                  "rounded-md p-1.5 transition",
                  displayType === "canvas" ? "bg-slate-100 text-indigo-600" : "text-slate-400"
                )}
                title="2D Visual Floor Canvas"
              >
                <MapIcon className="size-4" />
              </button>
              <button
                onClick={() => setDisplayType("grid")}
                className={cn(
                  "rounded-md p-1.5 transition",
                  displayType === "grid" ? "bg-slate-100 text-indigo-600" : "text-slate-400"
                )}
                title="Quick Matrix Grid"
              >
                <LayoutGrid className="size-4" />
              </button>
            </div>

            {/* Live Sync Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={refreshLiveTables}
              className="h-8 gap-1.5 text-xs"
              title="Refresh live data from PostgreSQL"
            >
              <RotateCcw className={cn("size-3.5", loading && "animate-spin")} />
              Sync DB
            </Button>

            {/* Blueprint Action: Add Floor */}
            <Button
              onClick={() => {
                setNewFloorName(`Floor ${sections.length + 1}`);
                setNewFloorType("ac_hall");
                setNewFloorCapacity(50);
                setNewFloorTheme("blueprint");
                setNewFloorAutoTables(true);
                setNewFloorTableCount(6);
                setNewFloorPrefix(`F${sections.length + 1}-`);
                setNewFloorShape("round");
                setNewFloorLayout("perimeter");
                setAddFloorOpen(true);
              }}
              className="h-8 gap-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white font-medium"
            >
              <Building2 className="size-3.5 text-sky-400" /> + Add Floor (Blueprint)
            </Button>

            {/* Quick Action: Add Table */}
            <Button
              onClick={() => {
                const targetSec = sections.find((s) => s.name === selectedArea) || sections[0];
                const prefix = targetSec ? targetSec.name.slice(0, 2).toUpperCase() : "T";
                setFormTableId(`${prefix}-${tables.length + 1}`);
                setFormTableName(`Table ${prefix}-${tables.length + 1}`);
                setFormSectionId(targetSec?.id || "");
                setFormSeats(4);
                setFormShape("round");
                setFormPosX(45);
                setFormPosY(45);
                setAddTableOpen(true);
              }}
              className="h-8 gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="size-3.5" /> Add Table (Layout)
            </Button>

            <Button asChild variant="outline" className="h-8 text-xs">
              <Link to="/pos">
                <Utensils className="size-3.5 mr-1" /> Open POS
              </Link>
            </Button>
          </div>
        }
      />

      {/* ── KPI Status Bar (Petpooja Standard Statuses) ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["Available", "Occupied", "Billing", "Reserved", "Cleaning"] as const).map((s) => {
          const colors = statusColors[s];
          const c = countByStatus(s);
          const label = s === "Occupied" ? "Running / Seated" : s;
          return (
            <div
              key={s}
              className={cn(
                "rounded-xl border p-3.5 flex flex-col justify-between shadow-2xs transition",
                colors.bg,
                colors.border
              )}
            >
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className={colors.text}>{label}</span>
                <span className="size-2 rounded-full bg-current" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">{c}</span>
                <span className="text-[11px] text-slate-500">
                  {Math.round((c / (tables.length || 1)) * 100)}% of tables
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Floor Section Tabs & Blueprint Controls ── */}
      <div className="space-y-2 pt-1">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Section Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {areas.map((a) => (
              <button
                key={a}
                onClick={() => setSelectedArea(a)}
                className={cn(
                  "rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5",
                  selectedArea === a
                    ? "bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/10"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                )}
              >
                <span>{a === "All" ? "🏢" : "📍"}</span>
                <span>{a === "All" ? "All Floors" : a}</span>
                <span className="text-[10px] opacity-75">
                  ({a === "All" ? tables.length : tables.filter((t) => t.area === a).length})
                </span>
              </button>
            ))}

            {/* Quick "+ New Floor" inline button */}
            <button
              onClick={() => {
                setNewFloorName(`Floor ${sections.length + 1}`);
                setNewFloorType("ac_hall");
                setNewFloorCapacity(50);
                setNewFloorAutoTables(true);
                setNewFloorTableCount(6);
                setNewFloorPrefix(`F${sections.length + 1}-`);
                setNewFloorShape("round");
                setNewFloorLayout("perimeter");
                setAddFloorOpen(true);
              }}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold border border-dashed border-slate-300 hover:border-indigo-500 hover:text-indigo-600 text-slate-500 bg-white/60 transition whitespace-nowrap flex items-center gap-1"
            >
              <Plus className="size-3" /> New Floor
            </button>
          </div>

          {/* Floor-specific Actions (when a single floor is active) */}
          <div className="flex flex-wrap items-center gap-2">
            {selectedArea !== "All" && (
              <>
                {/* Batch Table Sequencer Button */}
                <Button
                  size="sm"
                  onClick={() => {
                    setBatchFloorName(selectedArea);
                    setBatchCount(6);
                    setBatchPrefix(`${selectedArea.slice(0, 2).toUpperCase()}-`);
                    setBatchStartNum(tables.filter((t) => t.area === selectedArea).length + 1);
                    setBatchSeats(4);
                    setBatchShape("round");
                    setBatchLayout("grid");
                    setBatchModalOpen(true);
                  }}
                  className="h-7 px-2.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                >
                  <Wand2 className="size-3 mr-1 text-indigo-600" /> Auto-Number & Arrange
                </Button>

                {/* Delete Floor Button */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteFloor(selectedArea)}
                  className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  title={`Delete floor "${selectedArea}"`}
                >
                  <Trash2 className="size-3" />
                </Button>
              </>
            )}

            {viewMode === "builder" && (
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs text-amber-800">
                <Move className="size-3 text-amber-600 animate-pulse" />
                <span className="font-semibold">Builder Active:</span>
                <span>Drag tables to reposition</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Floor Plan Canvas or Grid ── */}
      {displayType === "canvas" ? (
        <FloorCanvasView
          tables={visibleTables}
          orders={orders}
          floorName={selectedArea}
          theme={floorThemes[selectedArea] || "blueprint"}
          isBuilder={viewMode === "builder"}
          onThemeChange={(th) => saveFloorTheme(selectedArea, th)}
          onSelectTable={(t) => {
            if (viewMode === "builder") {
              openEditDialog(t);
            } else {
              setSelectedTableId(t.id);
            }
          }}
          onTableMove={async (tableId, posX, posY) => {
            setTables((prev) =>
              prev.map((t) => (t.id === tableId ? { ...t, posX, posY } : t))
            );
            const target = tables.find((t) => t.id === tableId);
            const targetId = target?.backendId || tableId;
            try {
              await organizationService.updateTable(targetId, {
                position_x: posX,
                position_y: posY,
              });
              toast.success(
                `Table ${target?.name || tableId} moved to (${Math.round(posX)}%, ${Math.round(
                  posY
                )}%) and saved to PostgreSQL`
              );
            } catch (err: any) {
              console.error("Failed to persist table coordinates to backend:", err);
              toast.error(`Backend Error: ${err?.message || "Failed to save position in database"}`);
            }
          }}
        />
      ) : (
        <FloorGridView
          tables={visibleTables}
          orders={orders}
          onSelectTable={(t) => {
            if (viewMode === "builder") {
              openEditDialog(t);
            } else {
              setSelectedTableId(t.id);
            }
          }}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          PETPOOJA ACTION DRAWER: Live Table Operations
          ───────────────────────────────────────────────────────────── */}
      <Sheet open={!!activeTable} onOpenChange={(open) => !open && setSelectedTableId(null)}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col justify-between overflow-y-auto">
          {activeTable && (
            <div className="p-6 space-y-6">
              {/* Drawer Top Header */}
              <div className="flex items-start justify-between border-b pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-extrabold text-slate-900">
                      {activeTable.name || `Table ${activeTable.id}`}
                    </h2>
                    <StatusBadge status={activeTable.status} />
                  </div>
                  <p className="text-xs text-slate-500">
                    {activeTable.area} · Shape:{" "}
                    <span className="font-semibold capitalize">
                      {activeTable.shape?.replace("_", " ") || "Round"}
                    </span>{" "}
                    · Max {activeTable.seats} Covers
                  </p>
                </div>

                <button
                  onClick={() => openEditDialog(activeTable)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  title="Edit table shape or layout"
                >
                  <Edit3 className="size-4" />
                </button>
              </div>

              {/* Status Specific Overview Card */}
              {activeTable.status === "Occupied" && (
                <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-sky-900 flex items-center gap-1.5">
                      <Clock className="size-3.5 text-sky-600" /> Seated:{" "}
                      {activeTable.seatedMins ?? 0}m ago
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-sky-700 border border-sky-200">
                      Captain: {activeTable.waiter || "Ravi"}
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline pt-1">
                    <div>
                      <div className="text-[11px] text-slate-500 font-medium">Guest / Party</div>
                      <div className="text-sm font-bold text-slate-900">
                        {activeTable.customerName || "Walk-in Guests"}
                      </div>
                      {activeTable.customerPhone && (
                        <div className="text-[11px] text-slate-500">{activeTable.customerPhone}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500 font-medium">Running Bill</div>
                      <div className="text-lg font-black text-sky-900">
                        {activeOrder ? money(orderTotal(activeOrder.lines)) : "₹0"}
                      </div>
                    </div>
                  </div>

                  {/* Running Order Items */}
                  {activeOrder && activeOrder.lines.length > 0 && (
                    <div className="border-t border-sky-200/80 pt-2.5 space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-600 flex justify-between">
                        <span>Punched Dishes</span>
                        <span>{activeOrder.lines.length} items</span>
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1 text-xs">
                        {activeOrder.lines.map((l, i) => (
                          <div key={i} className="flex justify-between py-0.5 text-slate-700">
                            <span>
                              {l.qty}x {l.name}
                            </span>
                            <span className="font-semibold text-slate-900 tabular">
                              {money(l.qty * l.unitPrice)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTable.status === "Billing" && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5">
                      <Receipt className="size-3.5 text-amber-600" /> Bill Generated
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-amber-700 border border-amber-200">
                      Waiting for Payment
                    </span>
                  </div>

                  <div className="space-y-1 text-xs pt-1">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal:</span>
                      <span className="tabular font-medium">{money(orderBill?.subtotal || 0)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>GST (5%):</span>
                      <span className="tabular font-medium">{money(orderBill?.tax || 0)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Service Charge (5%):</span>
                      <span className="tabular font-medium">{money(orderBill?.service || 0)}</span>
                    </div>
                    <div className="flex justify-between text-base font-extrabold text-slate-900 border-t pt-2">
                      <span>Total Due:</span>
                      <span className="text-amber-900">{money(orderBill?.total || 0)}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTable.status === "Reserved" && (
                <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-4 space-y-2 text-xs">
                  <div className="font-bold text-purple-900 flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-purple-600" /> Table Reserved
                  </div>
                  <div>
                    Guest: <b>{activeTable.customerName || "Reserved Party"}</b> (
                    {activeTable.guests || activeTable.seats} covers)
                  </div>
                  <div className="text-slate-500">
                    Table held in database for evening dinner peak.
                  </div>
                </div>
              )}

              {activeTable.status === "Available" && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2 text-xs">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-600" /> Ready for Seating
                  </div>
                  <p className="text-slate-600">
                    Table is clean and registered in PostgreSQL. Available for walk-in covers or reservations.
                  </p>
                </div>
              )}

              {activeTable.status === "Cleaning" && (
                <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 space-y-2 text-xs">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <RotateCcw className="size-3.5 text-slate-600" /> Needs Sanitization
                  </div>
                  <p className="text-slate-600">
                    Sanitization and cutlery reset required before seating next covers.
                  </p>
                </div>
              )}

              {/* ── Operational Action Buttons (Petpooja Standard) ── */}
              <div className="space-y-2 pt-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Operational Actions
                </div>

                {activeTable.status === "Available" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => openSeatDialog(activeTable)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5"
                    >
                      <UserCheck className="size-4" /> Seat Walk-In
                    </Button>
                    <Button
                      onClick={() => openReserveDialog(activeTable)}
                      variant="outline"
                      className="w-full text-xs gap-1.5 border-purple-200 hover:bg-purple-50 text-purple-700"
                    >
                      <Calendar className="size-4" /> Reserve Table
                    </Button>
                  </div>
                )}

                {activeTable.status === "Occupied" && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Button asChild className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5">
                        <Link to="/pos" search={{ table: activeTable.id }}>
                          <Utensils className="size-4" /> Punch More (POS)
                        </Link>
                      </Button>
                      <Button
                        onClick={() => handleStatusChange(activeTable.id, "Billing")}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5"
                      >
                        <Receipt className="size-4" /> Generate Bill
                      </Button>
                    </div>

                    <Button
                      onClick={() => openTransferDialog(activeTable)}
                      variant="outline"
                      className="w-full text-xs gap-1.5 border-slate-300"
                    >
                      <ArrowRightLeft className="size-4 text-indigo-600" /> Shift / Transfer Table
                    </Button>
                  </div>
                )}

                {activeTable.status === "Billing" && (
                  <div className="space-y-2">
                    <Button
                      onClick={() => setPayPickerOpen(true)}
                      className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm gap-2"
                    >
                      <Wallet className="size-4" /> Settle Payment & Free Table
                    </Button>

                    <Button
                      onClick={() => setReceiptOpen(true)}
                      variant="outline"
                      className="w-full text-xs gap-1.5"
                    >
                      <Receipt className="size-4" /> View / Print Invoice
                    </Button>
                  </div>
                )}

                {activeTable.status === "Reserved" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => handleStatusChange(activeTable.id, "Occupied")}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
                    >
                      <UserCheck className="size-4" /> Seat Party Now
                    </Button>
                    <Button
                      onClick={() => handleStatusChange(activeTable.id, "Available")}
                      variant="outline"
                      className="w-full text-xs text-rose-600 hover:bg-rose-50"
                    >
                      Cancel Booking
                    </Button>
                  </div>
                )}

                {activeTable.status === "Cleaning" && (
                  <Button
                    onClick={() => handleStatusChange(activeTable.id, "Available")}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                  >
                    <CheckCircle2 className="size-4" /> Mark Clean & Ready
                  </Button>
                )}

                {/* Quick Status Override Selector */}
                <div className="pt-2">
                  <Label className="text-[10px] font-semibold text-slate-500 uppercase">
                    Direct Status Override
                  </Label>
                  <div className="grid grid-cols-5 gap-1.5 mt-1 text-[11px]">
                    {(["Available", "Occupied", "Billing", "Reserved", "Cleaning"] as const).map(
                      (st) => (
                        <button
                          key={st}
                          onClick={() => handleStatusChange(activeTable.id, st)}
                          className={cn(
                            "py-1 rounded border font-medium transition",
                            activeTable.status === st
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-white text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          {st === "Occupied" ? "Running" : st}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: Seat Walk-In Guests
          ───────────────────────────────────────────────────────────── */}
      <Dialog open={seatModalOpen} onOpenChange={setSeatModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="size-5 text-emerald-600" />
              Seat Guests on Table {selectedTableId}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Guest / Party Name</Label>
              <Input
                placeholder="e.g. Rahul Sharma"
                value={seatCustomerName}
                onChange={(e) => setSeatCustomerName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Phone Number</Label>
                <Input
                  placeholder="+91 98490 xxxxx"
                  value={seatCustomerPhone}
                  onChange={(e) => setSeatCustomerPhone(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Number of Covers</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={seatGuestCount}
                  onChange={(e) => setSeatGuestCount(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Assigned Captain / Waiter</Label>
              <select
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs"
                value={seatWaiter}
                onChange={(e) => setSeatWaiter(e.target.value)}
              >
                <option value="Ravi">Ravi (Main Hall Captain)</option>
                <option value="Sneha">Sneha (Terrace Captain)</option>
                <option value="Arjun">Arjun (Banquet Server)</option>
                <option value="Imran">Imran (Floor Captain)</option>
              </select>
            </div>
          </div>

          <DialogFooter className="flex sm:justify-between gap-2">
            <Button variant="outline" onClick={() => setSeatModalOpen(false)}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleSeatSubmit(false)}
                className="text-xs font-semibold"
              >
                Seat Table Only
              </Button>
              <Button
                onClick={() => handleSeatSubmit(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5"
              >
                Seat & Punch POS <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: Reserve Table
          ───────────────────────────────────────────────────────────── */}
      <Dialog open={reserveModalOpen} onOpenChange={setReserveModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="size-5 text-purple-600" />
              Reserve Table {selectedTableId}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Booking Guest Name</Label>
              <Input
                placeholder="e.g. Dr. K. V. Rao"
                value={resCustomerName}
                onChange={(e) => setResCustomerName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Contact Phone</Label>
                <Input
                  placeholder="+91 99890 xxxxx"
                  value={resCustomerPhone}
                  onChange={(e) => setResCustomerPhone(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Party Covers</Label>
                <Input
                  type="number"
                  min={1}
                  value={resCovers}
                  onChange={(e) => setResCovers(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Reservation Time</Label>
              <Input value={resTime} onChange={(e) => setResTime(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReserveModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReserveSubmit}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs"
            >
              Confirm Reservation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 3: Petpooja Table Transfer / Shift
          ───────────────────────────────────────────────────────────── */}
      <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="size-5 text-indigo-600" />
              Shift Table {selectedTableId} to Another Table
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-500">
              Transfer active seated guests, running orders, and KOT bills from Table{" "}
              <b>{selectedTableId}</b> to an empty table.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Destination Table</Label>
              <select
                className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold"
                value={targetTransferTableId}
                onChange={(e) => setTargetTransferTableId(e.target.value)}
              >
                {tables
                  .filter((t) => t.id !== selectedTableId && t.status === "Available")
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name || `Table ${t.id}`} ({t.area} · {t.seats} seats · {t.shape})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleTransferSubmit}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
            >
              Transfer & Merge Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 4: Add New Table (Floor Plan Builder)
          ───────────────────────────────────────────────────────────── */}
      <Dialog open={addTableOpen} onOpenChange={setAddTableOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-indigo-600" />
              Add Table to Floor Layout (PostgreSQL)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Table Code / ID</Label>
                <Input
                  placeholder="e.g. T15, B2"
                  value={formTableId}
                  onChange={(e) => setFormTableId(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Display Name</Label>
                <Input
                  placeholder="e.g. VIP Corner Booth"
                  value={formTableName}
                  onChange={(e) => setFormTableName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Section / Floor</Label>
                <select
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs"
                  value={formSectionId}
                  onChange={(e) => setFormSectionId(e.target.value)}
                >
                  {sections.length > 0 ? (
                    sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))
                  ) : (
                    <option value="">Main Hall (Default)</option>
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Seating Capacity</Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={formSeats}
                  onChange={(e) => setFormSeats(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Shape Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Table Physical Shape</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { shape: "round", label: "Round Table", icon: "🔘" },
                  { shape: "square", label: "Square Table", icon: "⬛" },
                  { shape: "rectangle", label: "Rectangle Banquet", icon: "▬" },
                  { shape: "l_shape", label: "L-Shaped Booth", icon: "🛋️" },
                  { shape: "bar_counter", label: "Bar Counter Stool", icon: "🍸" },
                ].map((s) => (
                  <button
                    key={s.shape}
                    type="button"
                    onClick={() => setFormShape(s.shape as TableShape)}
                    className={cn(
                      "p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1",
                      formShape === s.shape
                        ? "border-indigo-600 bg-indigo-50/70 text-indigo-900 ring-2 ring-indigo-500/20"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <span className="text-lg">{s.icon}</span>
                    <span className="text-[11px] font-semibold">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Floor Positioning Coordinates */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Floor X Position ({formPosX}%)</Label>
                <input
                  type="range"
                  min={10}
                  max={90}
                  value={formPosX}
                  onChange={(e) => setFormPosX(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Floor Y Position ({formPosY}%)</Label>
                <input
                  type="range"
                  min={15}
                  max={85}
                  value={formPosY}
                  onChange={(e) => setFormPosY(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTableOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddNewTable}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"
            >
              Save Table to PostgreSQL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 5: Edit Table Layout
          ───────────────────────────────────────────────────────────── */}
      <Dialog open={editTableOpen} onOpenChange={setEditTableOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="size-5 text-indigo-600" />
              Edit Table {formTableId}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Display Name</Label>
                <Input
                  value={formTableName}
                  onChange={(e) => setFormTableName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Seats</Label>
                <Input
                  type="number"
                  min={1}
                  value={formSeats}
                  onChange={(e) => setFormSeats(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Physical Shape</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { shape: "round", label: "Round", icon: "🔘" },
                  { shape: "square", label: "Square", icon: "⬛" },
                  { shape: "rectangle", label: "Rectangle", icon: "▬" },
                  { shape: "l_shape", label: "L-Booth", icon: "🛋️" },
                  { shape: "bar_counter", label: "Bar Stool", icon: "🍸" },
                ].map((s) => (
                  <button
                    key={s.shape}
                    type="button"
                    onClick={() => setFormShape(s.shape as TableShape)}
                    className={cn(
                      "p-2 rounded-xl border text-center transition flex flex-col items-center justify-center gap-0.5",
                      formShape === s.shape
                        ? "border-indigo-600 bg-indigo-50/70 text-indigo-900 font-bold"
                        : "border-slate-200 bg-white text-slate-700"
                    )}
                  >
                    <span>{s.icon}</span>
                    <span className="text-[11px]">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Position Sliders */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">X Position ({formPosX}%)</Label>
                <input
                  type="range"
                  min={10}
                  max={90}
                  value={formPosX}
                  onChange={(e) => setFormPosX(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Y Position ({formPosY}%)</Label>
                <input
                  type="range"
                  min={15}
                  max={85}
                  value={formPosY}
                  onChange={(e) => setFormPosY(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex sm:justify-between">
            <Button
              variant="destructive"
              onClick={() => handleDeleteTable(formTableId)}
              className="text-xs"
            >
              <Trash2 className="size-3.5 mr-1" /> Delete Table
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditTableOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditSubmit} className="bg-indigo-600 text-white text-xs">
                Save to PostgreSQL
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment & Receipt Dialogs */}
      <Dialog open={payPickerOpen} onOpenChange={setPayPickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Settle Bill for Table {activeTable?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="text-center font-black text-2xl text-slate-900">
              {money(orderBill?.total || 0)}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["UPI", "Cash", "Card", "Split"] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    if (activeTable?.orderId) {
                      storeSettleOrder(activeTable.orderId, m);
                      handleStatusChange(activeTable.id, "Cleaning");
                      toast.success(`Settled ${money(orderBill?.total || 0)} via ${m}`);
                      setPayPickerOpen(false);
                      setReceiptOpen(true);
                    }
                  }}
                  className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-900 font-bold transition text-center"
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 6: Add Floor & Blueprint Designer
          ───────────────────────────────────────────────────────────── */}
      <Dialog open={addFloorOpen} onOpenChange={setAddFloorOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-indigo-600" />
              Add New Floor / Architectural Blueprint
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Floor / Section Name</Label>
                <Input
                  placeholder="e.g. Rooftop Sky Bar"
                  value={newFloorName}
                  onChange={(e) => setNewFloorName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Dining Vertical / Type</Label>
                <select
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs"
                  value={newFloorType}
                  onChange={(e) => setNewFloorType(e.target.value)}
                >
                  <option value="ac_hall">AC Fine Dining Hall</option>
                  <option value="rooftop">Rooftop Open Sky Bar</option>
                  <option value="terrace">Outdoor Garden Terrace</option>
                  <option value="bar_counter">Cocktail Bar & Speakeasy</option>
                  <option value="banquet">Grand Banquet Ballroom</option>
                  <option value="pdr">Private Dining Room (VIP)</option>
                </select>
              </div>
            </div>



            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Total Floor Seating Capacity</Label>
              <Input
                type="number"
                min={10}
                max={500}
                value={newFloorCapacity}
                onChange={(e) => setNewFloorCapacity(Number(e.target.value))}
              />
            </div>

            {/* Option to Auto-populate initial tables */}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newFloorAutoTables}
                  onChange={(e) => setNewFloorAutoTables(e.target.checked)}
                  className="size-4 rounded accent-indigo-600"
                />
                <span className="text-xs font-bold text-indigo-950">
                  Auto-number and arrange initial tables on this floor
                </span>
              </label>

              {newFloorAutoTables && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-slate-700">Count</Label>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={newFloorTableCount}
                        onChange={(e) => setNewFloorTableCount(Number(e.target.value))}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-slate-700">Prefix</Label>
                      <Input
                        value={newFloorPrefix}
                        onChange={(e) => setNewFloorPrefix(e.target.value)}
                        placeholder="e.g. R-"
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-slate-700">Shape</Label>
                      <select
                        className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"
                        value={newFloorShape}
                        onChange={(e) => setNewFloorShape(e.target.value as TableShape)}
                      >
                        <option value="round">Round</option>
                        <option value="square">Square</option>
                        <option value="rectangle">Rectangle</option>
                        <option value="l_shape">L-Booth</option>
                        <option value="bar_counter">Bar Stool</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-slate-700">
                      Arrangement Layout Pattern
                    </Label>
                    <div className="grid grid-cols-4 gap-1.5 text-xs">
                      {[
                        { id: "perimeter", label: "Perimeter Ring" },
                        { id: "grid", label: "Symmetric Grid" },
                        { id: "cluster", label: "Center Cluster" },
                        { id: "diagonal", label: "Diagonal Stagger" },
                      ].map((ly) => (
                        <button
                          key={ly.id}
                          type="button"
                          onClick={() => setNewFloorLayout(ly.id as BlueprintLayout)}
                          className={cn(
                            "py-1 px-2 rounded-lg border text-center text-[11px] font-medium transition",
                            newFloorLayout === ly.id
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
                          )}
                        >
                          {ly.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFloorOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateFloor}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"
            >
              Save Floor & Blueprint to PostgreSQL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 7: Floor Table Sequencer & Custom Numbering
          ───────────────────────────────────────────────────────────── */}
      <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="size-5 text-indigo-600" />
              Batch Table Sequencer & Blueprint Numbering
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Target Floor / Dining Section</Label>
              <select
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs"
                value={batchFloorName}
                onChange={(e) => setBatchFloorName(e.target.value)}
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} ({s.section_type})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Table Count</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={batchCount}
                  onChange={(e) => setBatchCount(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Numbering Prefix</Label>
                <Input
                  placeholder="e.g. RT- or G-"
                  value={batchPrefix}
                  onChange={(e) => setBatchPrefix(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Start Number</Label>
                <Input
                  type="number"
                  min={1}
                  max={999}
                  value={batchStartNum}
                  onChange={(e) => setBatchStartNum(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Seats per Table</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={batchSeats}
                  onChange={(e) => setBatchSeats(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Physical Shape</Label>
                <select
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs"
                  value={batchShape}
                  onChange={(e) => setBatchShape(e.target.value as TableShape)}
                >
                  <option value="round">Round Table</option>
                  <option value="square">Square Table</option>
                  <option value="rectangle">Rectangle Banquet</option>
                  <option value="l_shape">L-Shaped Booth</option>
                  <option value="bar_counter">Bar Stool</option>
                </select>
              </div>
            </div>

            {/* Blueprint Arrangement Layout */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Arrangement Layout Pattern</Label>
              <div className="grid grid-cols-4 gap-2 text-xs">
                {[
                  { id: "perimeter", label: "Perimeter Ring", icon: "⭕" },
                  { id: "grid", label: "Symmetric Grid", icon: "▦" },
                  { id: "cluster", label: "Center Cluster", icon: "⏹️" },
                  { id: "diagonal", label: "Diagonal Stagger", icon: "📐" },
                ].map((ly) => (
                  <button
                    key={ly.id}
                    type="button"
                    onClick={() => setBatchLayout(ly.id as BlueprintLayout)}
                    className={cn(
                      "p-2 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1",
                      batchLayout === ly.id
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
                    )}
                  >
                    <span className="text-base">{ly.icon}</span>
                    <span className="text-[11px] font-semibold">{ly.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Numbering Preview */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Generated Numbering Sequence Preview
              </Label>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {Array.from({ length: Math.min(batchCount, 24) }).map((_, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-xs font-bold text-indigo-700 shadow-2xs"
                  >
                    {batchPrefix}
                    {batchStartNum + i}
                  </span>
                ))}
                {batchCount > 24 && (
                  <span className="text-xs text-slate-500 self-center">
                    +{batchCount - 24} more
                  </span>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBatchGenerateTables}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"
            >
              Generate & Save to PostgreSQL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT 1: Real-time 2D Visual Floor Canvas (Blueprint Architecture)
// ─────────────────────────────────────────────────────────────────────────────
function FloorCanvasView({
  tables,
  orders,
  floorName,
  theme,
  isBuilder,
  onThemeChange,
  onSelectTable,
  onTableMove,
}: {
  tables: RestaurantTable[];
  orders: any[];
  floorName: string;
  theme: BlueprintTheme;
  isBuilder: boolean;
  onThemeChange: (th: BlueprintTheme) => void;
  onSelectTable: (t: RestaurantTable) => void;
  onTableMove: (tableId: string, posX: number, posY: number) => Promise<void>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const themeConfig = BLUEPRINT_THEMES[theme] || BLUEPRINT_THEMES.blueprint;

  const [dragState, setDragState] = useState<{
    tableId: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    hasMoved: boolean;
  } | null>(null);

  // Rock-solid window pointer tracking for 60fps table drag-and-drop
  useEffect(() => {
    if (!dragState) return;

    const onWindowPointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = Math.abs(e.clientX - dragState.startX);
      const dy = Math.abs(e.clientY - dragState.startY);

      const rawX = ((e.clientX - rect.left) / rect.width) * 100;
      const rawY = ((e.clientY - rect.top) / rect.height) * 100;

      const clampedX = Math.min(92, Math.max(8, rawX));
      const clampedY = Math.min(88, Math.max(12, rawY));

      setDragState((prev) =>
        prev
          ? {
              ...prev,
              hasMoved: prev.hasMoved || dx > 4 || dy > 4,
              currentX: Math.round(clampedX * 10) / 10,
              currentY: Math.round(clampedY * 10) / 10,
            }
          : null
      );
    };

    const onWindowPointerUp = async () => {
      const state = dragState;
      setDragState(null);

      if (state.hasMoved) {
        await onTableMove(state.tableId, state.currentX, state.currentY);
      } else {
        const found = tables.find((t) => t.id === state.tableId);
        if (found) onSelectTable(found);
      }
    };

    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerUp);
    return () => {
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerUp);
    };
  }, [dragState, onTableMove, onSelectTable, tables]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-[640px] rounded-3xl border-2 bg-slate-50/90 overflow-hidden shadow-inner select-none transition-colors",
        isBuilder ? "border-amber-300 ring-2 ring-amber-100" : "border-slate-200"
      )}
    >
      {/* Neat Clean Floor Dot Grid */}
      <div
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(#94a3b8 1px, transparent 1px), radial-gradient(#cbd5e1 1px, #f8fafc 1px)",
          backgroundSize: "24px 24px",
          backgroundPosition: "0 0, 12px 12px",
        }}
      />

      {/* Mode Status Banner inside Canvas */}
      <div className="absolute top-3 left-6 z-20 flex items-center gap-2">
        <div className="rounded-md bg-white border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-600 shadow-2xs pointer-events-none flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500" /> Main Dining Entry
        </div>
        {floorName !== "All" && (
          <div className="rounded-md bg-white border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-700 shadow-2xs pointer-events-none flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-indigo-500" /> {floorName} ({tables.length} tables)
          </div>
        )}
        {isBuilder ? (
          <div className="rounded-md bg-amber-500 text-white px-2.5 py-1 text-[10px] font-bold shadow-xs flex items-center gap-1.5 animate-pulse">
            <Move className="size-3" /> Drag & Drop Tables Active · Auto-saves to PostgreSQL
          </div>
        ) : (
          <div className="rounded-md bg-white border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-700 shadow-2xs pointer-events-none flex items-center gap-1.5">
            <Lock className="size-3 text-emerald-600" /> Live Service Mode · Tables Fixed (Click to Open Drawer)
          </div>
        )}
      </div>

      {/* Kitchen & Service Counter on Bottom-Right */}
      <div className="absolute bottom-3 right-6 z-20 rounded-md bg-white border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-600 shadow-2xs pointer-events-none flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-amber-500" /> Kitchen & Service Station
      </div>

      {/* Render Each Real-Time Table Node at (posX, posY) */}
      {tables.map((t) => {
        const o = t.orderId ? orders.find((x) => x.id === t.orderId) : undefined;
        const colors = statusColors[t.status];
        const isDragging = dragState?.tableId === t.id;
        const left = isDragging ? dragState.currentX : (t.posX ?? 50);
        const top = isDragging ? dragState.currentY : (t.posY ?? 50);

        return (
          <div
            key={t.id}
            style={{ left: `${left}%`, top: `${top}%` }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              if (!isBuilder) {
                // In Live Service mode: tables are fixed/locked. No drag!
                return;
              }
              setDragState({
                tableId: t.id,
                startX: e.clientX,
                startY: e.clientY,
                currentX: t.posX ?? 50,
                currentY: t.posY ?? 50,
                hasMoved: false,
              });
            }}
            onClick={() => {
              if (!isBuilder) {
                onSelectTable(t);
              }
            }}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 touch-none select-none transition-transform",
              isBuilder
                ? isDragging
                  ? "z-50 scale-110 cursor-grabbing"
                  : "cursor-grab hover:scale-105 hover:z-30 group"
                : "cursor-pointer hover:scale-105 hover:z-30 group"
            )}
          >
            {/* Visual Physical Shape Renderer */}
            <div
              className={cn(
                "relative flex flex-col items-center justify-center transition-all shadow-lg group-hover:shadow-2xl border-2",
                colors.bg,
                colors.border,
                isDragging && "ring-4 ring-indigo-500/60 shadow-2xl scale-105",
                t.shape === "round" && "size-24 rounded-full",
                t.shape === "square" && "size-24 rounded-2xl",
                t.shape === "rectangle" && "w-36 h-20 rounded-2xl",
                t.shape === "l_shape" && "size-28 rounded-2xl",
                t.shape === "bar_counter" && "w-32 h-14 rounded-full"
              )}
            >
              <TableChairsDecoration shape={t.shape || "round"} />

              {/* Table Center Content */}
              <div className="z-10 text-center pointer-events-none px-1">
                <div className="font-black text-sm text-slate-900 leading-tight">
                  {t.id}
                </div>
                <div className="text-[10px] font-semibold text-slate-700 mt-0.5">
                  {t.status === "Occupied" && o ? (
                    <span className="text-sky-950 font-extrabold">{money(orderTotal(o.lines))}</span>
                  ) : t.status === "Reserved" ? (
                    <span className="text-purple-800 font-bold">Reserved</span>
                  ) : t.status === "Billing" ? (
                    <span className="text-amber-900 font-extrabold">Billed</span>
                  ) : (
                    <span>{t.seats} seats</span>
                  )}
                </div>

                {t.customerName && t.status === "Occupied" && (
                  <div className="text-[9px] text-slate-600 font-semibold truncate max-w-[80px]">
                    {t.customerName.split(" ")[0]}
                  </div>
                )}
              </div>

              {/* Coordinates Pill when Dragging */}
              {isDragging && (
                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 rounded-full bg-slate-950 px-2.5 py-0.5 text-[9px] font-mono font-bold text-white shadow-xl whitespace-nowrap z-50 border border-slate-700">
                  X: {Math.round(left)}% · Y: {Math.round(top)}%
                </div>
              )}

              {/* Status Indicator Pip */}
              <span
                className={cn(
                  "absolute -top-1 -right-1 size-3.5 rounded-full border-2 border-white shadow-xs",
                  t.status === "Available" && "bg-emerald-500",
                  t.status === "Occupied" && "bg-sky-500 animate-pulse",
                  t.status === "Billing" && "bg-amber-500 animate-bounce",
                  t.status === "Reserved" && "bg-purple-500",
                  t.status === "Cleaning" && "bg-slate-400"
                )}
              />
            </div>

            {/* Hover Tooltip / Quick Info Pill */}
            {!isDragging && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 hidden group-hover:flex items-center gap-1.5 rounded-md bg-slate-950/90 border border-slate-800 px-2.5 py-1 text-[10px] font-semibold text-white whitespace-nowrap shadow-xl z-40 backdrop-blur-sm">
                <span className="font-bold text-sky-400">{t.name || `Table ${t.id}`}</span>
                <span>·</span>
                <span className="capitalize">{t.status}</span>
                <span>·</span>
                <span className="text-slate-400">Drag to save to DB</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT 2: Shape & Chairs Visual Decorations
// ─────────────────────────────────────────────────────────────────────────────
function TableChairsDecoration({ shape }: { shape: TableShape }) {
  if (shape === "round") {
    return (
      <>
        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 size-4 rounded-full bg-slate-300 border border-slate-400/50" />
        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 size-4 rounded-full bg-slate-300 border border-slate-400/50" />
        <span className="absolute top-1/2 -left-1.5 -translate-y-1/2 size-4 rounded-full bg-slate-300 border border-slate-400/50" />
        <span className="absolute top-1/2 -right-1.5 -translate-y-1/2 size-4 rounded-full bg-slate-300 border border-slate-400/50" />
      </>
    );
  }

  if (shape === "square") {
    return (
      <>
        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-2 rounded-t-sm bg-slate-300 border border-slate-400/50" />
        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-2 rounded-b-sm bg-slate-300 border border-slate-400/50" />
        <span className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2 h-6 rounded-l-sm bg-slate-300 border border-slate-400/50" />
        <span className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2 h-6 rounded-r-sm bg-slate-300 border border-slate-400/50" />
      </>
    );
  }

  if (shape === "rectangle") {
    return (
      <>
        <div className="absolute -top-1.5 inset-x-3 flex justify-between">
          <span className="w-5 h-2 rounded-t-sm bg-slate-300 border border-slate-400/50" />
          <span className="w-5 h-2 rounded-t-sm bg-slate-300 border border-slate-400/50" />
          <span className="w-5 h-2 rounded-t-sm bg-slate-300 border border-slate-400/50" />
        </div>
        <div className="absolute -bottom-1.5 inset-x-3 flex justify-between">
          <span className="w-5 h-2 rounded-b-sm bg-slate-300 border border-slate-400/50" />
          <span className="w-5 h-2 rounded-b-sm bg-slate-300 border border-slate-400/50" />
          <span className="w-5 h-2 rounded-b-sm bg-slate-300 border border-slate-400/50" />
        </div>
      </>
    );
  }

  if (shape === "l_shape") {
    return (
      <div className="absolute top-1 left-1 size-10 border-t-4 border-l-4 border-indigo-400 rounded-tl-xl pointer-events-none" />
    );
  }

  if (shape === "bar_counter") {
    return (
      <>
        <span className="absolute -bottom-1 left-4 size-3 rounded-full bg-slate-400 border border-slate-500" />
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-3 rounded-full bg-slate-400 border border-slate-500" />
        <span className="absolute -bottom-1 right-4 size-3 rounded-full bg-slate-400 border border-slate-500" />
      </>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT 3: Standard Matrix Grid View
// ─────────────────────────────────────────────────────────────────────────────
function FloorGridView({
  tables,
  orders,
  onSelectTable,
}: {
  tables: RestaurantTable[];
  orders: any[];
  onSelectTable: (t: RestaurantTable) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {tables.map((t) => {
        const o = t.orderId ? orders.find((x) => x.id === t.orderId) : undefined;
        const colors = statusColors[t.status];

        return (
          <div
            key={t.id}
            onClick={() => onSelectTable(t)}
            className={cn(
              "p-3 rounded-2xl border-2 flex flex-col justify-between cursor-pointer transition hover:shadow-md",
              colors.bg,
              colors.border
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-base text-slate-900">{t.id}</span>
              <span className="text-[10px] text-slate-500 capitalize">{t.shape || "round"}</span>
            </div>

            <div className="my-2">
              <div className="text-xs font-bold text-slate-800 truncate">
                {t.name || `Table ${t.id}`}
              </div>
              <div className="text-[11px] text-slate-500">
                {t.area} · Max {t.seats} seats
              </div>
            </div>

            <div className="mt-auto pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
              <StatusBadge status={t.status} />
              {o && (
                <span className="font-bold text-sky-900 tabular">{money(orderTotal(o.lines))}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
