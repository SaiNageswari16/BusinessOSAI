import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  Grid2X2,
  Layers,
  LayoutGrid,
  Plus,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { MenuCategorySidebar } from "@/components/menu/MenuCategorySidebar";
import { MenuGridCenter } from "@/components/menu/MenuGridCenter";
import { MenuItemDetailsPanel } from "@/components/menu/MenuItemDetailsPanel";
import {
  AddEditMenuItemModal,
  DeleteMenuItemModal,
  ImportMenuModal,
  ManageCategoriesModal,
} from "@/components/menu/MenuModals";
import {
  filterAndSortMenuItems,
  getMenuDisplayName,
  MENU_SIDEBAR_CATEGORIES,
  type MenuFilterState,
} from "@/components/menu/menu-utils";
import { MODIFIERS } from "@/lib/seed";
import { useRestaurantStore } from "@/lib/store";
import type { MenuItem } from "@/lib/types";

export const Route = createFileRoute("/menu")({
  component: MenuManagementScreen,
});

const INITIAL_FILTER_STATE: MenuFilterState = {
  sidebarCategory: "all",
  dropdownCategory: "all",
  availability: "all",
  dietary: "all",
  searchQuery: "",
  sortBy: "name-asc",
};

function MenuManagementScreen() {
  const menu = useRestaurantStore((s) => s.menu);
  const combos = useRestaurantStore((s) => s.combos);
  const ingredients = useRestaurantStore((s) => s.ingredients);
  const settings = useRestaurantStore((s) => s.settings);

  const toggleMenuAvailability = useRestaurantStore((s) => s.toggleMenuAvailability);
  const saveMenuItem = useRestaurantStore((s) => s.saveMenuItem);
  const duplicateMenuItem = useRestaurantStore((s) => s.duplicateMenuItem);
  const deleteMenuItem = useRestaurantStore((s) => s.deleteMenuItem);

  const [filterState, setFilterState] = useState<MenuFilterState>(INITIAL_FILTER_STATE);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedItemId, setSelectedItemId] = useState<string>("M22");
  const [favoriteIds, setFavoriteIds] = useState<string[]>(["M22", "M1", "M14"]);
  const [customCategories, setCustomCategories] = useState<string[]>([
    "Seasonal Specials",
    "Chef's Tasting",
  ]);

  // Modal states
  const [addEditModalOpen, setAddEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const filteredItems = useMemo(
    () => filterAndSortMenuItems(menu, filterState, customCategories),
    [menu, filterState, customCategories],
  );

  const selectedItem = useMemo(() => {
    const direct = menu.find((m) => m.id === selectedItemId);
    if (direct) return direct;
    return filteredItems[0] ?? menu[0];
  }, [menu, selectedItemId, filteredItems]);

  const categoryDropdownOptions = useMemo(() => {
    const standard = MENU_SIDEBAR_CATEGORIES.map((c) => c.label);
    return Array.from(new Set([...standard, ...customCategories]));
  }, [customCategories]);

  const handleUpdateFilter = (patch: Partial<MenuFilterState>) => {
    setFilterState((prev) => ({ ...prev, ...patch }));
  };

  const handleClearFilters = () => {
    setFilterState(INITIAL_FILTER_STATE);
  };

  const handleToggleFavorite = (itemId: string) => {
    setFavoriteIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
    );
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setAddEditModalOpen(true);
  };

  const handleOpenEditModal = (item: MenuItem) => {
    setSelectedItemId(item.id);
    setEditingItem(item);
    setAddEditModalOpen(true);
  };

  const handleSaveMenuItem = (itemData: Omit<MenuItem, "id"> & { id?: string }) => {
    const savedId = saveMenuItem(itemData);
    setSelectedItemId(savedId);
    toast.success(
      itemData.id
        ? `Updated "${itemData.name === "Hyderabadi Chicken Biryani" ? "Chicken Biryani" : itemData.name}"`
        : `Added "${itemData.name}" to menu`,
    );
  };

  const handleDuplicateItem = (item: MenuItem) => {
    const res = duplicateMenuItem(item.id);
    if (!res.ok || !res.newItem) {
      toast.error(res.error ?? "Could not duplicate item");
      return;
    }
    setSelectedItemId(res.newItem.id);
    toast.success(`Duplicated "${getMenuDisplayName(item)}"`);
  };

  const handleConfirmDelete = (item: MenuItem) => {
    const displayName = getMenuDisplayName(item);
    const res = deleteMenuItem(item.id);
    if (!res.ok) {
      toast.error(res.error ?? "Could not delete item");
      return;
    }
    toast.success(`Deleted "${displayName}" from menu`);
  };

  const handleToggleAvailability = (item: MenuItem) => {
    toggleMenuAvailability(item.id);
    const nextAvail = !item.available;
    toast.success(
      `${getMenuDisplayName(item)} marked ${nextAvail ? "Available" : "Sold Out"} (synced with POS)`,
    );
  };

  const handleToggleBestseller = (item: MenuItem) => {
    saveMenuItem({
      ...item,
      bestseller: !item.bestseller,
    });
    toast.success(
      `${getMenuDisplayName(item)} ${!item.bestseller ? "marked as Bestseller" : "removed from Bestsellers"}`,
    );
  };

  const handleUpdateItemPatch = (item: MenuItem, patch: Partial<MenuItem>) => {
    saveMenuItem({
      ...item,
      ...patch,
    });
    toast.success(`Updated ${getMenuDisplayName(item)}`);
  };

  const handleAddCustomCategory = (name: string) => {
    if (!customCategories.some((c) => c.toLowerCase() === name.toLowerCase())) {
      setCustomCategories((prev) => [...prev, name]);
    }
  };

  const handleRemoveCustomCategory = (name: string) => {
    setCustomCategories((prev) => prev.filter((c) => c !== name));
  };

  const handleImportItems = (items: Array<Omit<MenuItem, "id">>) => {
    let lastId = selectedItemId;
    for (const it of items) {
      lastId = saveMenuItem(it);
    }
    setSelectedItemId(lastId);
    toast.success(`Imported ${items.length} menu item${items.length > 1 ? "s" : ""}`);
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-3.5 px-3 py-3 sm:px-5">
      {/* 1. Page Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E1E9F4] bg-white px-5 py-3.5 shadow-2xs">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#102344]">
            Menu Management
          </h1>
          <p className="mt-0.5 text-[13px] font-medium text-[#5B6B82]">
            Create, manage and organize your restaurant menu items, categories, modifiers and
            combos.
          </p>
        </div>

        {/* Summary KPI Cards + Import & Add Item Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Card 1: Total Items */}
          <div className="flex items-center gap-2.5 rounded-xl border border-[#DCE8FA] bg-[#F0F6FF] px-3 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E0EDFF] text-[#0866F5]">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[16px] font-extrabold leading-none text-[#0866F5] tabular">
                {menu.length}
              </div>
              <div className="mt-0.5 text-[10.5px] font-semibold text-[#526581]">Total Items</div>
            </div>
          </div>

          {/* Card 2: Categories */}
          <div className="flex items-center gap-2.5 rounded-xl border border-[#F8E4BA] bg-[#FFF8EB] px-3 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FDEBC8] text-[#D97706]">
              <LayoutGrid className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[16px] font-extrabold leading-none text-[#B45309] tabular">
                {MENU_SIDEBAR_CATEGORIES.length}
              </div>
              <div className="mt-0.5 text-[10.5px] font-semibold text-[#855B1E]">Categories</div>
            </div>
          </div>

          {/* Card 3: Combos */}
          <div className="flex items-center gap-2.5 rounded-xl border border-[#E5D8FD] bg-[#F5F0FF] px-3 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EBE0FF] text-[#7C3AED]">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[16px] font-extrabold leading-none text-[#6D28D9] tabular">
                {combos.length}
              </div>
              <div className="mt-0.5 text-[10.5px] font-semibold text-[#5B4282]">Combos</div>
            </div>
          </div>

          {/* Card 4: Modifiers */}
          <div className="flex items-center gap-2.5 rounded-xl border border-[#C6F6D9] bg-[#ECFDF5] px-3 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D1FAE5] text-[#059669]">
              <Grid2X2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[16px] font-extrabold leading-none text-[#065F46] tabular">
                {MODIFIERS.length}
              </div>
              <div className="mt-0.5 text-[10.5px] font-semibold text-[#1F6F54]">Modifiers</div>
            </div>
          </div>

          {/* Import Button */}
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D5E0EE] bg-white px-4 text-[13px] font-extrabold text-[#102344] shadow-2xs transition-colors hover:bg-[#F8FAFC]"
          >
            <Upload className="h-4 w-4 text-[#334155]" />
            <span>Import</span>
          </button>

          {/* Add Item Primary Button */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0866F5] px-4 text-[13px] font-extrabold text-white shadow-xs transition-colors hover:bg-[#0756D0]"
          >
            <Plus className="h-4 w-4" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* 2. Three-Column Workspace */}
      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start">
        {/* Left Sidebar */}
        <MenuCategorySidebar
          activeCategory={filterState.sidebarCategory}
          totalItemsCount={menu.length}
          combosCount={combos.length}
          customCategories={customCategories}
          onSelectCategory={(catId) => handleUpdateFilter({ sidebarCategory: catId })}
          onOpenManageCategories={() => setManageCategoriesOpen(true)}
        />

        {/* Center Grid / List Workspace */}
        <MenuGridCenter
          items={filteredItems}
          totalMenuCount={menu.length}
          selectedItemId={selectedItem?.id ?? ""}
          filterState={filterState}
          viewMode={viewMode}
          favoriteIds={favoriteIds}
          categoryOptions={categoryDropdownOptions}
          onSelectItem={(item) => setSelectedItemId(item.id)}
          onUpdateFilter={handleUpdateFilter}
          onClearFilters={handleClearFilters}
          onChangeViewMode={setViewMode}
          onToggleFavorite={handleToggleFavorite}
          onEditItem={handleOpenEditModal}
          onDuplicateItem={handleDuplicateItem}
          onDeleteItem={(item) => setDeletingItem(item)}
          onToggleAvailability={handleToggleAvailability}
          onToggleBestseller={handleToggleBestseller}
        />

        {/* Right Details Inspector Panel */}
        <MenuItemDetailsPanel
          item={selectedItem}
          gstPct={settings.gstPct}
          ingredients={ingredients}
          onEditItem={handleOpenEditModal}
          onDuplicateItem={handleDuplicateItem}
          onDeleteItem={(item) => setDeletingItem(item)}
          onToggleAvailability={handleToggleAvailability}
          onUpdateItemPatch={handleUpdateItemPatch}
        />
      </div>

      {/* Modals */}
      <AddEditMenuItemModal
        open={addEditModalOpen}
        editingItem={editingItem}
        categories={categoryDropdownOptions}
        ingredients={ingredients}
        onClose={() => setAddEditModalOpen(false)}
        onSave={handleSaveMenuItem}
      />

      <DeleteMenuItemModal
        item={deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirmDelete={handleConfirmDelete}
      />

      <ManageCategoriesModal
        open={manageCategoriesOpen}
        customCategories={customCategories}
        onClose={() => setManageCategoriesOpen(false)}
        onAddCustomCategory={handleAddCustomCategory}
        onRemoveCustomCategory={handleRemoveCustomCategory}
      />

      <ImportMenuModal
        open={importModalOpen}
        menu={menu}
        onClose={() => setImportModalOpen(false)}
        onImportItems={handleImportItems}
      />
    </div>
  );
}
