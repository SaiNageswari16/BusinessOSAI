import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";

// Product Master
import { Products } from "../components/inventory/Products";
import { Categories } from "../components/inventory/Categories";
import { Brands } from "../components/inventory/Brands";
import { UnitsOfMeasure } from "../components/inventory/UnitsOfMeasure";
import { ProductAttributes } from "../components/inventory/ProductAttributes";
import { ProductVariants } from "../components/inventory/ProductVariants";
import { ProductBundles } from "../components/inventory/ProductBundles";
import { ProductKits } from "../components/inventory/ProductKits";
import { ProductImages } from "../components/inventory/ProductImages";

// Inventory Operations
import { StockOverview } from "../components/inventory/StockOverview";
import { GoodsReceipt } from "../components/inventory/GoodsReceipt";
import { GoodsIssue } from "../components/inventory/GoodsIssue";
import { StockMovement } from "../components/inventory/StockMovement";
import { StockAdjustment } from "../components/inventory/StockAdjustment";
import { StockTransfer } from "../components/inventory/StockTransfer";
import { CycleCounting } from "../components/inventory/CycleCounting";
import { PhysicalStockAudit } from "../components/inventory/PhysicalStockAudit";

// Warehouse Management
import { Warehouses } from "../components/inventory/Warehouses";
import { StorageLocations } from "../components/inventory/StorageLocations";
import { WarehouseZones } from "../components/inventory/WarehouseZones";
import { Racks } from "../components/inventory/Racks";
import { Bins } from "../components/inventory/Bins";
import { PutAwayRules } from "../components/inventory/PutAwayRules";
import { PickingRules } from "../components/inventory/PickingRules";

// Batch & Traceability
import { BatchNumbers } from "../components/inventory/BatchNumbers";
import { SerialNumbers } from "../components/inventory/SerialNumbers";
import { Traceability } from "../components/inventory/Traceability";
import { ExpiryManagement } from "../components/inventory/ExpiryManagement";
import { ManufacturingDates } from "../components/inventory/ManufacturingDates";
import { BarcodeManagement } from "../components/inventory/BarcodeManagement";
import { QrCodeManagement } from "../components/inventory/QrCodeManagement";
import { RfidManagement } from "../components/inventory/RfidManagement";

// Inventory Intelligence
import { AiInventoryHealth } from "../components/inventory/AiInventoryHealth";
import { InventoryIntelligence } from "../components/inventory/InventoryIntelligence";
import { LowStockAlerts } from "../components/inventory/LowStockAlerts";
import { ReorderPlanning } from "../components/inventory/ReorderPlanning";
import { SlowMoving } from "../components/inventory/SlowMoving";
import { FastMoving } from "../components/inventory/FastMoving";
import { DeadStock } from "../components/inventory/DeadStock";
import { AbcAnalysis } from "../components/inventory/AbcAnalysis";
import { XyzAnalysis } from "../components/inventory/XyzAnalysis";
import { InventoryForecast } from "../components/inventory/InventoryForecast";

import { MasterCatalogAdmin } from "../components/inventory/MasterCatalogAdmin";

export const Route = createFileRoute("/_app/inventory")({
  component: InventoryModule,
});

const componentMap: Record<string, React.ElementType> = {
  // Product Master
  products: Products,
  categories: Categories,
  brands: Brands,
  master_catalog: MasterCatalogAdmin,
  units: UnitsOfMeasure,
  attributes: ProductAttributes,
  variants: ProductVariants,
  bundles: ProductBundles,
  kits: ProductKits,
  images: ProductImages,

  // Operations
  stock_overview: StockOverview,
  goods_receipt: GoodsReceipt,
  goods_issue: GoodsIssue,
  stock_movement: StockMovement,
  stock_adjustment: StockAdjustment,
  stock_transfer: StockTransfer,
  cycle_counting: CycleCounting,
  physical_audit: PhysicalStockAudit,

  // Warehouse
  warehouses: Warehouses,
  storage_locations: StorageLocations,
  zones: WarehouseZones,
  racks: Racks,
  bins: Bins,
  put_away_rules: PutAwayRules,
  picking_rules: PickingRules,

  // Batch
  batches: BatchNumbers,
  serials: SerialNumbers,
  traceability: Traceability,
  expiry: ExpiryManagement,
  mfg_dates: ManufacturingDates,
  barcodes: BarcodeManagement,
  qrcodes: QrCodeManagement,
  rfid: RfidManagement,

  // Intelligence
  ai_health: InventoryIntelligence,
  intelligence: InventoryIntelligence,
  low_stock: LowStockAlerts,
  reorder_planning: ReorderPlanning,
  slow_moving: SlowMoving,
  fast_moving: FastMoving,
  dead_stock: DeadStock,
  abc_analysis: AbcAnalysis,
  xyz_analysis: XyzAnalysis,
  forecast: InventoryForecast,
};

function InventoryModule() {
  const routerState = useRouterState();
  const searchStr = routerState.location.searchStr;
  
  let activeTab = "products";
  if (searchStr.includes("tab=")) {
    const params = new URLSearchParams(searchStr);
    activeTab = params.get("tab") || "products";
  }

  const ActiveComponent = componentMap[activeTab] || Products;

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="flex-1 relative bg-background/50 p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
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
