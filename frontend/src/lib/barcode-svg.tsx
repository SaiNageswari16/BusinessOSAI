/**
 * Shared Barcode SVG renderer — ISO/IEC 15417 Code-128 / GS1 EAN-13
 * Hardware-scannable: strict integer module widths, floor-accumulated X positions.
 * All bars snap exactly to pixel grid — no sub-pixel float drift.
 */
import { useMemo } from "react";
import { getHardwareScannableBarcode } from "./code128";
import { useCurrency } from "@/hooks/use-currency";

export interface ProductBarcodeLike {
  product_name: string;
  barcode?: string | null;
  sku?: string;
  selling_price?: number | null;
  mrp?: number | null;
  category_name?: string;
  format?: string;
}

/**
 * RealBarcodeSvg — renders a hardware-scannable SVG barcode.
 * - Uses strict integer px widths per module (no float accumulation)
 * - X positions accumulated as integer module count so bars always align to pixel boundaries
 */
export function RealBarcodeSvg({
  code,
  width = 220,
  height = 52,
  unitPx = 2,
}: {
  code: string;
  format?: string;
  width?: number;
  height?: number;
  unitPx?: number;
}) {
    const { currency, formatCurrency } = useCurrency();
  const bars = useMemo(
    () => getHardwareScannableBarcode(code || "8901234567890"),
    [code]
  );

  // Use exact integer unitPx — critical for scanner compatibility
  const unit = Math.max(1, Math.round(unitPx));
  const quietZone = 16; // ISO/IEC 15417 minimum quiet zone
  let totalModules = 0;
  bars.forEach((b) => (totalModules += b.width));
  const contentWidth = totalModules * unit;
  const svgWidth = Math.max(width, contentWidth + quietZone * 2);
  const barHeight = Math.max(24, height - 14);

  return (
    <div className="flex flex-col items-center justify-center bg-white p-0 rounded overflow-hidden">
      <svg
        width={svgWidth}
        height={height}
        shapeRendering="crispEdges"
        style={{ display: "block" }}
      >
        <rect width={svgWidth} height={height} fill="white" />
        {(() => {
          let xModules = 0; // accumulate in integer module units
          return bars.map((b, i) => {
            const xPx = quietZone + xModules * unit;
            const wPx = b.width * unit;
            xModules += b.width;
            if (!b.isBlack) return null;
            return (
              <rect
                key={i}
                x={xPx}
                y={2}
                width={Math.max(1, wPx)}
                height={barHeight}
                fill="#000000"
              />
            );
          });
        })()}
        <text
          x={svgWidth / 2}
          y={height - 2}
          textAnchor="middle"
          fontSize="9"
          fontFamily="monospace"
          fontWeight="bold"
          fill="black"
        >
          {code}
        </text>
      </svg>
    </div>
  );
}

/**
 * SingleBarcodeLabelCard — renders a single product barcode label per template.
 */
export function SingleBarcodeLabelCard({
  item,
  template,
  isPrint = false,
}: {
  item: ProductBarcodeLike;
  template: any;
  isPrint?: boolean;
}) {
  const f = template.fields || {};
  const storeName = template.storeName || "LAZYMONKEY AI SUPERSTORE";

  return (
    <div
      className={`bg-white text-black border border-slate-300 rounded ${
        isPrint ? "p-1 h-[24mm]" : "p-2.5 min-h-[210px]"
      } flex flex-col justify-between font-sans shadow-sm select-none overflow-hidden box-border`}
    >
      {/* Company Header */}
      {f.showCompanyName && (
        <div className="flex items-center justify-between border-b border-slate-200 pb-0.5 mb-0.5">
          <span
            className={`font-bold ${
              isPrint ? "text-[8px]" : "text-[9px]"
            } tracking-wider uppercase truncate`}
            style={{ color: template.primaryColor || "#000" }}
          >
            {storeName}
          </span>
          {f.showCategoryBrand && item.category_name && (
            <span
              className={`font-semibold text-slate-500 uppercase ${
                isPrint ? "text-[7px]" : "text-[7.5px]"
              }`}
            >
              {item.category_name}
            </span>
          )}
        </div>
      )}

      {/* Product Name & SKU */}
      <div>
        {f.showProductName && (
          <h4
            className={`font-bold leading-tight text-slate-900 line-clamp-1 ${
              isPrint ? "text-[9px]" : "text-[11px]"
            }`}
          >
            {item.product_name}
          </h4>
        )}
        {f.showSKU && item.sku && (
          <p
            className={`font-mono text-slate-600 ${
              isPrint ? "text-[7.5px]" : "text-[8.5px]"
            }`}
          >
            SKU: {item.sku}
          </p>
        )}
        <div className="flex items-baseline gap-1.5 mt-0.5">
          {f.showPrice && item.selling_price != null && (
            <span
              className={`font-extrabold text-slate-900 ${
                isPrint ? "text-[10px]" : "text-xs"
              }`}
            >
              {currency.symbol}{Number(item.selling_price).toFixed(2)}
            </span>
          )}
          {f.showMRP && item.mrp != null && (
            <span
              className={`text-slate-500 line-through ${
                isPrint ? "text-[7.5px]" : "text-[8.5px]"
              }`}
            >
              MRP: {currency.symbol}{Number(item.mrp).toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Barcode Graphic */}
      {f.showBarcodeGraphic && item.barcode && (
        <div className="mt-0.5">
          <RealBarcodeSvg
            code={item.barcode}
            width={isPrint ? 160 : 220}
            height={isPrint ? 34 : 52}
            unitPx={isPrint ? 1 : 2}
          />
        </div>
      )}
    </div>
  );
}
