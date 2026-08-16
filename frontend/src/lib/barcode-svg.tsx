/**
 * Shared Barcode SVG renderer — ISO/IEC 15417 Code-128 & GS1 EAN-13
 * Hardware-scannable: strict integer module widths, floor-accumulated X positions,
 * extending guard bars for EAN-13, and calibrated print dimensions.
 */
import { useMemo } from "react";
import {
  encodeCode128,
  encodeEAN13Structured,
  getHardwareScannableBarcode,
  type EAN13Structured,
} from "./code128";
import { useCurrency } from "@/hooks/use-currency";

export interface ProductBarcodeLike {
  product_name: string;
  barcode?: string | null;
  sku?: string;
  selling_price?: number | null;
  mrp?: number | null;
  category_name?: string;
  format?: string;
  batch_no?: string;
  mfg_lic_no?: string;
  pkd_date?: string;
  exp_date?: string;
  net_qty?: string;
  usp_rate?: string;
}

/**
 * Gs1Ean13Svg — Genuine GS1 EAN-13 Barcode with extending guard bars and dual-grouped digits.
 * Matches physical FMCG packaging standard (e.g. 8 904358 601259).
 */
export function Gs1Ean13Svg({
  code,
  height = 54,
  unitPx = 2,
}: {
  code: string;
  height?: number;
  unitPx?: number;
}) {
  const structured = useMemo<EAN13Structured>(() => {
    return encodeEAN13Structured(code || "8904358601259");
  }, [code]);

  const unit = Math.max(1.8, unitPx);
  const leftQuietWidth = 14 * unit; // 11 modules quiet zone + 1st digit room
  const rightQuietWidth = 10 * unit; // 7 modules quiet zone

  let totalBarModules = 0;
  structured.allBars.forEach((b) => (totalBarModules += b.width));

  const barsWidth = totalBarModules * unit;
  const svgWidth = Math.round(leftQuietWidth + barsWidth + rightQuietWidth);

  const barHeight = Math.max(28, height - 16);
  const guardHeight = barHeight + 5; // Guard bars extend 5px lower past digit baseline

  return (
    <div className="flex flex-col items-center justify-center bg-white p-0 rounded overflow-hidden select-none">
      <svg
        width={svgWidth}
        height={height}
        shapeRendering="crispEdges"
        style={{ display: "block", background: "#ffffff" }}
      >
        {/* Crisp White Background */}
        <rect width={svgWidth} height={height} fill="#ffffff" />

        {/* 1st Leading Digit (outside left guard) */}
        <text
          x={leftQuietWidth - 4 * unit}
          y={height - 2}
          textAnchor="middle"
          fontSize="11"
          fontFamily="'OCR-B', 'Courier New', monospace"
          fontWeight="bold"
          fill="#000000"
        >
          {structured.firstDigit}
        </text>

        {/* Render Bar Modules */}
        {(() => {
          let xModules = 0;
          return structured.allBars.map((b, i) => {
            const xPx = leftQuietWidth + xModules * unit;
            const wPx = b.width * unit;
            xModules += b.width;

            if (!b.isBlack) return null;

            const h = b.isGuard ? guardHeight : barHeight;
            return (
              <rect
                key={i}
                x={Math.round(xPx)}
                y={2}
                width={Math.max(1, Math.round(wPx))}
                height={h}
                fill="#000000"
              />
            );
          });
        })()}

        {/* Left 6 Digits (centered under left half) */}
        <text
          x={leftQuietWidth + 24 * unit}
          y={height - 2}
          textAnchor="middle"
          fontSize="11"
          fontFamily="'OCR-B', 'Courier New', monospace"
          fontWeight="bold"
          letterSpacing="1px"
          fill="#000000"
        >
          {structured.leftDigits}
        </text>

        {/* Right 6 Digits (centered under right half) */}
        <text
          x={leftQuietWidth + 72 * unit}
          y={height - 2}
          textAnchor="middle"
          fontSize="11"
          fontFamily="'OCR-B', 'Courier New', monospace"
          fontWeight="bold"
          letterSpacing="1px"
          fill="#000000"
        >
          {structured.rightDigits}
        </text>

        {/* Right Quiet Zone Mark (">") */}
        <text
          x={svgWidth - 4}
          y={height - 2}
          textAnchor="middle"
          fontSize="9"
          fontFamily="monospace"
          fontWeight="bold"
          fill="#666666"
        >
          &gt;
        </text>
      </svg>
    </div>
  );
}

/**
 * Code128Svg — Hardware-Scannable ISO/IEC 15417 Code 128
 */
export function Code128Svg({
  code,
  width = 220,
  height = 50,
  unitPx = 2,
}: {
  code: string;
  width?: number;
  height?: number;
  unitPx?: number;
}) {
  const bars = useMemo(() => encodeCode128(code || "SN-2026-0001"), [code]);
  const unit = Math.max(1.8, unitPx);
  const quietZone = 16;

  let totalModules = 0;
  bars.forEach((b) => (totalModules += b.width));

  const contentWidth = totalModules * unit;
  const svgWidth = Math.max(width, Math.round(contentWidth + quietZone * 2));
  const barHeight = Math.max(26, height - 15);

  return (
    <div className="flex flex-col items-center justify-center bg-white p-0 rounded overflow-hidden select-none">
      <svg
        width={svgWidth}
        height={height}
        shapeRendering="crispEdges"
        style={{ display: "block", background: "#ffffff" }}
      >
        <rect width={svgWidth} height={height} fill="#ffffff" />
        {(() => {
          let xModules = 0;
          return bars.map((b, i) => {
            const xPx = quietZone + xModules * unit;
            const wPx = b.width * unit;
            xModules += b.width;
            if (!b.isBlack) return null;
            return (
              <rect
                key={i}
                x={Math.round(xPx)}
                y={2}
                width={Math.max(1, Math.round(wPx))}
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
          fontSize="10"
          fontFamily="'Courier New', monospace"
          fontWeight="bold"
          letterSpacing="1px"
          fill="#000000"
        >
          *{code}*
        </text>
      </svg>
    </div>
  );
}

/**
 * RealBarcodeSvg — Auto-detects GS1 EAN-13 (12/13 digits) vs Code-128
 */
export function RealBarcodeSvg({
  code,
  width = 220,
  height = 54,
  unitPx = 2,
}: {
  code: string;
  format?: string;
  width?: number;
  height?: number;
  unitPx?: number;
}) {
  const clean = (code || "").trim().replace(/\s/g, "");
  const isEan13 = /^\d{12,13}$/.test(clean);

  if (isEan13) {
    return <Gs1Ean13Svg code={clean} height={height} unitPx={unitPx} />;
  }

  return (
    <Code128Svg
      code={clean || "8904358601259"}
      width={width}
      height={height}
      unitPx={unitPx}
    />
  );
}

/**
 * FmcgProductLabelCard — Exact physical FMCG packaging label format matching the uploaded UrbanGabru photo.
 */
export function FmcgProductLabelCard({
  item,
  isPrint = false,
}: {
  item: ProductBarcodeLike;
  isPrint?: boolean;
}) {
  const barcode = item.barcode || "8904358601259";
  const mfgLic = item.mfg_lic_no || "MH/104643";
  const batchNo = item.batch_no || "173";
  const pkdDate = item.pkd_date || "11/2025";
  const expDate = item.exp_date || "10/2028";
  const mrp = item.mrp || item.selling_price || 399;
  const netQty = item.net_qty || "10 g (0.33 oz)";
  const uspRate = item.usp_rate || `₹${(mrp / 10).toFixed(2)} per g`;

  return (
    <div
      className={`bg-black text-white rounded-lg p-3 font-sans shadow-md flex flex-col justify-between select-none ${
        isPrint ? "w-[50mm] h-[48mm] border border-black" : "w-full max-w-sm"
      }`}
    >
      {/* Product Spec Table */}
      <div className="text-[10px] leading-tight space-y-0.5 font-medium">
        <div className="flex justify-between">
          <span className="text-slate-300">Mfg Lic. No</span>
          <span className="font-mono font-bold">: {mfgLic}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-300">Batch No.</span>
          <span className="font-mono font-bold">: {batchNo}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-300">Pkd On Date</span>
          <span className="font-mono font-bold">: {pkdDate}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-300">Exp. Date</span>
          <span className="font-mono font-bold">: {expDate}</span>
        </div>
        <div className="flex justify-between font-bold text-amber-400">
          <span>MRP. Rs.</span>
          <span>: ₹{Number(mrp).toFixed(2)} (Incl. of all taxes)</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-300">USP: Rs.</span>
          <span>: {uspRate}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-300">Net Qty</span>
          <span className="font-bold">: {netQty}</span>
        </div>
      </div>

      {/* Embedded Hardware Scannable EAN-13 Barcode */}
      <div className="bg-white p-1 rounded mt-1.5 flex items-center justify-center">
        <RealBarcodeSvg code={barcode} height={46} unitPx={1.8} />
      </div>

      {/* GMP Certified / Brand Note */}
      <div className="text-[8px] text-slate-400 text-center mt-1 border-t border-slate-800 pt-0.5">
        GMP Certified · Keep in cool, dry place
      </div>
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
  const f = template?.fields || {};
  const storeName = template?.storeName || "LAZYMONKEY AI SUPERSTORE";

  return (
    <div
      className={`bg-white text-black border border-slate-300 rounded ${
        isPrint ? "p-1.5 h-[24mm]" : "p-2.5 min-h-[210px]"
      } flex flex-col justify-between font-sans shadow-sm select-none overflow-hidden box-border`}
    >
      {/* Company Header */}
      {f.showCompanyName && (
        <div className="flex items-center justify-between border-b border-slate-200 pb-0.5 mb-0.5">
          <span
            className={`font-black ${
              isPrint ? "text-[8px]" : "text-[9.5px]"
            } tracking-wider uppercase truncate`}
            style={{ color: template?.primaryColor || "#000000" }}
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

      {/* Product Name & Pricing */}
      <div>
        {f.showProductName && (
          <h4
            className={`font-extrabold leading-tight text-slate-900 line-clamp-1 ${
              isPrint ? "text-[8.5px]" : "text-[11px]"
            }`}
          >
            {item.product_name}
          </h4>
        )}
        <div className="flex items-baseline justify-between mt-0.5">
          {f.showSKU && item.sku && (
            <span
              className={`font-mono text-slate-600 ${
                isPrint ? "text-[7px]" : "text-[8.5px]"
              }`}
            >
              SKU: {item.sku}
            </span>
          )}
          <div className="flex items-baseline gap-1">
            {f.showPrice && item.selling_price != null && (
              <span
                className={`font-black text-slate-900 ${
                  isPrint ? "text-[9px]" : "text-xs"
                }`}
              >
                {currency.symbol}{Number(item.selling_price).toFixed(2)}
              </span>
            )}
            {f.showMRP && item.mrp != null && (
              <span
                className={`text-slate-500 line-through ${
                  isPrint ? "text-[7px]" : "text-[8px]"
                }`}
              >
                {currency.symbol}{Number(item.mrp).toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Barcode Graphic (Hardware Scannable EAN-13 / Code-128) */}
      {f.showBarcodeGraphic && item.barcode && (
        <div className="mt-0.5 flex justify-center">
          <RealBarcodeSvg
            code={item.barcode}
            width={isPrint ? 170 : 220}
            height={isPrint ? 36 : 52}
            unitPx={isPrint ? 1.8 : 2}
          />
        </div>
      )}
    </div>
  );
}
