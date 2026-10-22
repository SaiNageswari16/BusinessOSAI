import {
  Armchair,
  Bike,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  UserRound,
  Users,
  Utensils,
  X,
} from "lucide-react";

import { POS_CATEGORIES } from "@/components/pos/pos-config";
import type { PosDraft } from "@/lib/store";
import type { Customer, DiningTable, OrderType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PosLeftSidebarProps {
  posDraft: PosDraft;
  selectedTable: DiningTable | undefined;
  selectedCustomer: Customer | undefined;
  activeCategory: string;
  onSelectOrderType: (type: OrderType) => void;
  onOpenTableSelector: () => void;
  onChangeGuests: (guests: number) => void;
  onClearCustomer: () => void;
  onOpenCustomerSelector: () => void;
  onSelectCategory: (categoryId: string) => void;
  onOpenCustomItemModal: () => void;
  onSelectProvider: (provider: string) => void;
}

export function PosLeftSidebar({
  posDraft,
  selectedTable,
  selectedCustomer,
  activeCategory,
  onSelectOrderType,
  onOpenTableSelector,
  onChangeGuests,
  onClearCustomer,
  onOpenCustomerSelector,
  onSelectCategory,
  onOpenCustomItemModal,
  onSelectProvider,
}: PosLeftSidebarProps) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-2.5 rounded-2xl border border-[#E1E9F4] bg-white p-3 shadow-xs lg:w-[238px] xl:w-[248px]">
      {/* 1. Order Type Selector */}
      <div className="grid grid-cols-3 gap-1.5">
        {(
          [
            { id: "dine-in", label: "Dine In", icon: Utensils },
            { id: "takeaway", label: "Takeaway", icon: ShoppingBag },
            { id: "delivery", label: "Delivery", icon: Bike },
          ] as const
        ).map(({ id, label, icon: Icon }) => {
          const active = posDraft.orderType === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectOrderType(id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl border py-2.5 px-1.5 text-[11px] font-bold transition-all",
                active
                  ? "border-[#0866F5] bg-[#0866F5] text-white shadow-xs"
                  : "border-[#E2E8F0] bg-[#F4F7FC] text-[#1E293B] hover:border-blue-200 hover:bg-[#EBF3FF]",
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-white" : "text-[#334155]")} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Table Selection Card (Dine In) or Channel Card (Takeaway / Delivery) */}
      {posDraft.orderType === "dine-in" ? (
        <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#FAFBFD] px-3 py-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#334155]">
              <Armchair className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-medium leading-none text-[#64748B]">Table</div>
              <div className="mt-0.5 text-[15px] font-extrabold leading-tight text-[#102344]">
                {selectedTable?.name ?? posDraft.tableId ?? "Select"}
              </div>
              <div className="truncate text-[10.5px] text-[#64748B]">
                {selectedTable
                  ? `${selectedTable.area} • ${selectedTable.capacity} Seats`
                  : "Main Hall • 4 Seats"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenTableSelector}
            className="shrink-0 rounded-md px-1.5 py-1 text-[11px] font-bold text-[#0866F5] transition-colors hover:bg-blue-50"
          >
            Change
          </button>
        </div>
      ) : posDraft.orderType === "takeaway" ? (
        <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#FAFBFD] px-3 py-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#0866F5]">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] font-medium leading-none text-[#64748B]">Counter</div>
              <div className="mt-0.5 text-[13px] font-extrabold text-[#102344]">
                Express Takeaway
              </div>
              <div className="text-[10.5px] text-[#64748B]">Self-Pickup • Parcel Pack</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E8F0] bg-[#FAFBFD] px-3 py-2 space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
            Delivery Partner
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(["Own fleet", "Swiggy (demo)", "Zomato (demo)"] as const).map((prov) => {
              const active = (posDraft.provider ?? "Own fleet") === prov;
              return (
                <button
                  key={prov}
                  type="button"
                  onClick={() => onSelectProvider(prov)}
                  className={cn(
                    "truncate rounded-md border px-1.5 py-1 text-[10px] font-semibold transition-colors",
                    active
                      ? "border-[#0866F5] bg-[#0866F5] text-white"
                      : "border-[#E2E8F0] bg-white text-[#475569] hover:bg-slate-50",
                  )}
                >
                  {prov.replace(" (demo)", "")}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Guests Stepper Row */}
      <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#FAFBFD] px-3 py-1.5">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-[#102344]">
          <Users className="h-4 w-4 text-[#334155]" />
          <span>Guests</span>
        </div>
        <div className="inline-flex h-7 items-center rounded-lg border border-[#D8E3F2] bg-white">
          <button
            type="button"
            aria-label="Decrease guests"
            onClick={() => onChangeGuests(Math.max(1, posDraft.guests - 1))}
            className="flex h-full w-7 items-center justify-center rounded-l-lg text-[#0866F5] transition-colors hover:bg-blue-50"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-7 text-center text-[12px] font-bold text-[#102344] tabular">
            {posDraft.guests}
          </span>
          <button
            type="button"
            aria-label="Increase guests"
            onClick={() => onChangeGuests(Math.min(24, posDraft.guests + 1))}
            className="flex h-full w-7 items-center justify-center rounded-r-lg text-[#0866F5] transition-colors hover:bg-blue-50"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 4. Customer Selection Card */}
      <div className="flex items-center justify-between gap-1.5 rounded-xl border border-[#E2E8F0] bg-[#FAFBFD] px-2.5 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-[#334155]">
            <UserRound className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-medium leading-none text-[#64748B]">Customer</div>
            <div className="mt-0.5 truncate text-[12.5px] font-extrabold leading-tight text-[#102344]">
              {selectedCustomer ? selectedCustomer.name : "Walk-in Guest"}
            </div>
            <div className="truncate text-[10.5px] text-[#64748B] tabular">
              {selectedCustomer ? selectedCustomer.phone : "Link CRM loyalty"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selectedCustomer && (
            <button
              type="button"
              aria-label="Clear customer"
              onClick={onClearCustomer}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[#64748B] transition-colors hover:bg-slate-200/60 hover:text-[#102344]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            aria-label="Search or select customer"
            onClick={onOpenCustomerSelector}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EBF3FF] text-[#0866F5] transition-colors hover:bg-[#DBEAFE]"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 5. Menu Categories List */}
      <nav aria-label="Menu categories" className="flex-1 space-y-0.5 py-0.5">
        {POS_CATEGORIES.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={cn(
                "relative flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-[12px] transition-all",
                active
                  ? "bg-[#E8F2FF] font-bold text-[#0866F5] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r before:bg-[#0866F5]"
                  : "font-medium text-[#1E293B] hover:bg-[#F4F7FC]",
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[12px]",
                    cat.iconBg,
                    cat.iconColor,
                  )}
                >
                  {cat.emoji}
                </span>
                <span className="truncate">{cat.label}</span>
              </div>
              <span
                className={cn(
                  "ml-2 shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] tabular",
                  active
                    ? "bg-[#D2E5FF] font-bold text-[#0866F5]"
                    : "bg-[#F1F5F9] font-semibold text-[#64748B]",
                )}
              >
                {cat.badgeCount}
              </span>
            </button>
          );
        })}
      </nav>

      {/* 6. Custom Item Action Button */}
      <button
        type="button"
        onClick={onOpenCustomItemModal}
        className="mt-auto flex w-full items-center gap-2.5 rounded-xl bg-[#0B1E36] px-3 py-2.5 text-left text-white shadow-xs transition-colors hover:bg-[#132C4E]"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/12">
          <Plus className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-bold leading-tight">Custom Item</div>
          <div className="mt-0.5 truncate text-[10px] text-slate-300">Add item not in menu</div>
        </div>
      </button>
    </aside>
  );
}
