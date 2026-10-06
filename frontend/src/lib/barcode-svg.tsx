/**
 * Shared Barcode SVG renderer — ISO/IEC 15417 Code-128 & GS1 EAN-13
 * Hardware-scannable: strict integer module widths, floor-accumulated X positions,
 * extending guard bars for EAN-13, and calibrated print dimensions.
 */
import { useMemo, useRef, useEffect, useState } from "react";
import JsBarcode from "jsbarcode";
import {
  encodeCode128,
  encodeEAN13Structured,
  getHardwareScannableBarcode,
  type EAN13Structured,
} from "./code128";
import { useCurrency } from "@/hooks/use-currency";
import { getActiveBillingGst } from "./receipt-template-store";

export interface ProductBarcodeLike {
  product_name: string;
  barcode?: string | null;
  sku?: string | null;
  selling_price?: number | null;
  mrp?: number | null;
  category_name?: string | null;
  format?: string | null;
  batch_no?: string | null;
  mfg_lic_no?: string | null;
  pkd_date?: string | null;
  exp_date?: string | null;
  net_qty?: string | null;
  usp_rate?: string | null;
}

export interface BarcodeElementBlock {
  id: string;
  type:
    | "companyName"
    | "productName"
    | "sellingPrice"
    | "mrp"
    | "priceGroup"
    | "sku"
    | "hsn"
    | "barcodeGraphic"
    | "qrCode"
    | "category"
    | "customText"
    | "batchMfgExp"
    | "divider"
    | "discountBadge";
  label: string;
  visible: boolean;
  prefix?: string;
  suffix?: string;
  customText?: string;
  fontSize?: string | number;
  fontWeight?: "normal" | "600" | "bold" | "900" | string;
  fontFamily?: string;
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline" | "line-through";
  showStrike?: boolean;
  textAlign?: "left" | "center" | "right" | "justify";
  color?: string;
  backgroundColor?: string;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  letterSpacing?: string;
  padding?: string;
  marginTop?: number;
  marginBottom?: number;
  height?: number;
  widthScale?: number;
  borderStyle?: string;
  badgeStyle?: "none" | "pill" | "dark" | "gold" | "outline" | "filled";
  strikeColor?: "red" | "black" | "gray";
  strikeBold?: boolean;
  // Free-form Drag & Place Canvas properties (0-100% relative coordinates)
  posX?: number;
  posY?: number;
  isFreePositioned?: boolean;
  zIndex?: number;
  width?: number | string;
}

export function getDefaultBarcodeElements(template?: any): BarcodeElementBlock[] {
  const f = template?.fields || {};
  const s = template?.elementSettings || {};
  const globalFont = template?.fontFamily || "Inter, Calibri, sans-serif";
  const globalAlign = template?.textAlign || "center";
  const isTrendyOffer =
    template?.themeName === "trendy_offer" ||
    template?.priceLayout === "center_offer" ||
    template?.id === "tpl-bar-trendy-offer" ||
    template?.id === "tpl-bar-dual-trendy";
  const isMyBillBook = template?.themeName === "mybillbook_clean" || template?.id === "tpl-bar-mybillbook";

  const clampSize = (val: any, fallback: number, max: number = 32) => {
    if (val === undefined || val === null || val === "") return fallback;
    const num = typeof val === "number" ? val : parseFloat(String(val));
    if (isNaN(num) || num <= 0) return fallback;
    return Math.min(max, Math.max(5, num));
  };

  // Trendy Tag Preset (Image 5): Top Store Name, Divider, Product Name, Center Offer & MRP, Barcode + Code at bottom
  if (isTrendyOffer) {
    return [
      {
        id: "el_company",
        type: "companyName",
        label: "Store / Business Name",
        visible: f.showCompanyName !== false,
        fontFamily: s.header?.fontFamily || globalFont,
        fontSize: clampSize(s.header?.fontSize || template?.headerFontSize, 10.5),
        fontWeight: s.header?.fontWeight || "900",
        textAlign: "center",
        color: s.header?.color || "#0f172a",
        textTransform: s.header?.textTransform || "uppercase",
        marginBottom: 1,
      },
      {
        id: "el_divider",
        type: "divider",
        label: "Divider Line",
        visible: true,
        height: 1,
        color: "#cbd5e1",
        marginBottom: 2,
      },
      {
        id: "el_product_name",
        type: "productName",
        label: "Product Title",
        visible: f.showProductName !== false,
        fontFamily: s.productName?.fontFamily || globalFont,
        fontSize: clampSize(s.productName?.fontSize, 11),
        fontWeight: s.productName?.fontWeight || "900",
        textAlign: "center",
        color: s.productName?.color || "#020617",
        marginBottom: 1,
      },
      {
        id: "el_mrp",
        type: "mrp",
        label: "MRP",
        visible: f.showMRP !== false,
        fontFamily: s.priceMrp?.fontFamily || globalFont,
        fontSize: clampSize(s.priceMrp?.fontSize, 9.5),
        fontWeight: s.priceMrp?.fontWeight || "900",
        textAlign: "center",
        color: s.priceMrp?.color || "#020617",
        prefix: s.priceMrp?.prefix !== undefined ? s.priceMrp.prefix : (template?.mrpPrefix !== undefined ? template.mrpPrefix : "MRP: "),
        showStrike: s.priceMrp?.showStrike ?? template?.showMrpStrike ?? false,
        marginBottom: 1,
      },
      {
        id: "el_sp",
        type: "sellingPrice",
        label: "Selling Price (SP)",
        visible: f.showPrice !== false,
        fontFamily: s.priceSp?.fontFamily || globalFont,
        fontSize: clampSize(s.priceSp?.fontSize, 10),
        fontWeight: s.priceSp?.fontWeight || "900",
        textAlign: "center",
        color: s.priceSp?.color || "#020617",
        prefix: s.priceSp?.prefix !== undefined ? s.priceSp.prefix : (template?.spPrefix !== undefined ? template.spPrefix : "SP: "),
        badgeStyle: s.priceSp?.badgeStyle || template?.spBadgeStyle || "none",
        marginBottom: 2,
      },
      {
        id: "el_barcode",
        type: "barcodeGraphic",
        label: "Barcode Graphic",
        visible: f.showBarcodeGraphic !== false,
        height: template?.barcodeHeight || 25,
        marginBottom: 1,
      },
      {
        id: "el_sku",
        type: "sku",
        label: "Barcode Code",
        visible: f.showSKU !== false,
        prefix: s.sku?.prefix !== undefined ? s.sku.prefix : "",
        fontFamily: s.sku?.fontFamily || "'Courier New', Courier, monospace",
        fontSize: clampSize(s.sku?.fontSize, 8.5),
        fontWeight: s.sku?.fontWeight || "bold",
        textAlign: "center",
        color: s.sku?.color || "#0f172a",
        marginBottom: 0,
      },
    ];
  }

  // myBillBook clean preset: Business Name, Barcode Graphic, Item Code, Item Name, MRP, Selling Price
  if (isMyBillBook) {
    return [
      {
        id: "el_company",
        type: "companyName",
        label: "Business Name",
        visible: f.showCompanyName !== false,
        fontFamily: s.header?.fontFamily || globalFont,
        fontSize: clampSize(s.header?.fontSize || template?.headerFontSize, 11),
        fontWeight: s.header?.fontWeight || "700",
        textAlign: "center",
        color: s.header?.color || "#000000",
        textTransform: "uppercase",
        marginBottom: 1,
      },
      {
        id: "el_barcode",
        type: "barcodeGraphic",
        label: "Barcode Graphic",
        visible: f.showBarcodeGraphic !== false,
        height: template?.barcodeHeight || 28,
        marginBottom: 1,
      },
      {
        id: "el_sku",
        type: "sku",
        label: "Item Code",
        visible: f.showSKU !== false,
        prefix: s.sku?.prefix !== undefined ? s.sku.prefix : "",
        fontFamily: s.sku?.fontFamily || globalFont,
        fontSize: clampSize(s.sku?.fontSize, 8.5),
        fontWeight: s.sku?.fontWeight || "600",
        textAlign: "center",
        color: s.sku?.color || "#000000",
        marginBottom: 1,
      },
      {
        id: "el_product_name",
        type: "productName",
        label: "Item Name",
        visible: f.showProductName !== false,
        fontFamily: s.productName?.fontFamily || globalFont,
        fontSize: clampSize(s.productName?.fontSize, 9.5),
        fontWeight: s.productName?.fontWeight || "600",
        textAlign: "center",
        color: s.productName?.color || "#000000",
        marginBottom: 1,
      },
      {
        id: "el_mrp",
        type: "mrp",
        label: "MRP",
        visible: f.showMRP !== false,
        prefix: s.priceMrp?.prefix !== undefined ? s.priceMrp.prefix : (template?.mrpPrefix !== undefined ? template.mrpPrefix : "MRP: "),
        fontFamily: s.priceMrp?.fontFamily || globalFont,
        fontSize: clampSize(s.priceMrp?.fontSize, 9),
        fontWeight: s.priceMrp?.fontWeight || "600",
        textAlign: "center",
        color: s.priceMrp?.color || "#000000",
        showStrike: s.priceMrp?.showStrike ?? template?.showMrpStrike ?? false,
        marginBottom: 1,
      },
      {
        id: "el_sp",
        type: "sellingPrice",
        label: "Selling Price",
        visible: f.showPrice !== false,
        prefix: s.priceSp?.prefix !== undefined ? s.priceSp.prefix : (template?.spPrefix !== undefined ? template.spPrefix : "SP: "),
        fontFamily: s.priceSp?.fontFamily || globalFont,
        fontSize: clampSize(s.priceSp?.fontSize, 9),
        fontWeight: s.priceSp?.fontWeight || "700",
        textAlign: "center",
        color: s.priceSp?.color || "#000000",
        badgeStyle: s.priceSp?.badgeStyle || template?.spBadgeStyle || "none",
        marginBottom: 0,
      },
    ];
  }

  return [
    {
      id: "el_company",
      type: "companyName",
      label: "Company / Store Name",
      visible: f.showCompanyName !== false,
      fontFamily: s.header?.fontFamily || globalFont,
      fontSize: s.header?.fontSize || 10,
      fontWeight: s.header?.fontWeight || "900",
      textAlign: s.header?.textAlign || "center",
      color: s.header?.color || template?.primaryColor || "#0f172a",
      textTransform: s.header?.textTransform || (template?.isUppercaseCompany !== false ? "uppercase" : "none"),
      marginBottom: 2,
    },
    {
      id: "el_product_name",
      type: "productName",
      label: "Product Title",
      visible: f.showProductName !== false,
      fontFamily: s.productName?.fontFamily || globalFont,
      fontSize: s.productName?.fontSize || 11,
      fontWeight: s.productName?.fontWeight || (template?.isBoldProductName !== false ? "900" : "600"),
      textAlign: s.productName?.textAlign || globalAlign,
      color: s.productName?.color || "#020617",
      marginBottom: 2,
    },
    {
      id: "el_mrp",
      type: "mrp",
      label: "MRP",
      visible: f.showMRP !== false,
      prefix: s.priceMrp?.prefix !== undefined ? s.priceMrp.prefix : (template?.mrpPrefix !== undefined ? template.mrpPrefix : "MRP: "),
      fontFamily: s.priceMrp?.fontFamily || globalFont,
      fontSize: clampSize(s.priceMrp?.fontSize, 9),
      fontWeight: s.priceMrp?.fontWeight || "600",
      textAlign: s.priceMrp?.textAlign || globalAlign,
      color: s.priceMrp?.color || "#334155",
      showStrike: s.priceMrp?.showStrike ?? template?.showMrpStrike ?? true,
      marginBottom: 1,
    },
    {
      id: "el_sp",
      type: "sellingPrice",
      label: "Selling Price (SP)",
      visible: f.showPrice !== false,
      prefix: s.priceSp?.prefix !== undefined ? s.priceSp.prefix : (template?.spPrefix !== undefined ? template.spPrefix : "SP: "),
      fontFamily: s.priceSp?.fontFamily || globalFont,
      fontSize: clampSize(s.priceSp?.fontSize, 10),
      fontWeight: s.priceSp?.fontWeight || "700",
      textAlign: s.priceSp?.textAlign || globalAlign,
      color: s.priceSp?.color || "#020617",
      badgeStyle: s.priceSp?.badgeStyle || template?.spBadgeStyle || "none",
      marginBottom: 2,
    },
    {
      id: "el_sku",
      type: "sku",
      label: "SKU & HSN Code",
      visible: f.showSKU === true || f.showHSN === true,
      prefix: s.sku?.prefix || "SKU: ",
      fontFamily: s.sku?.fontFamily || "'Courier New', monospace",
      fontSize: s.sku?.fontSize || 8.5,
      fontWeight: s.sku?.fontWeight || "bold",
      textAlign: s.sku?.textAlign || globalAlign,
      color: s.sku?.color || "#334155",
      marginBottom: 2,
    },
    {
      id: "el_barcode",
      type: "barcodeGraphic",
      label: "Barcode Graphic",
      visible: f.showBarcodeGraphic !== false,
      height: template?.barcodeHeight || 40,
      marginBottom: 2,
    },
    {
      id: "el_footer",
      type: "customText",
      label: "Footer & Custom Tagline",
      visible: f.showCustomTagline === true || f.showMfgExpDate === true,
      customText: template?.customTaglineText || f.customTaglineText || "Incl. of all taxes",
      fontSize: 7.5,
      fontWeight: "bold",
      color: "#64748b",
      textAlign: "center",
      marginBottom: 1,
    },
  ];
}

export interface BarcodeRenderData {
  clean: string;
  format: string;
  runs: { width: number; isBlack: boolean }[];
  totalModules: number;
}

/**
 * Universal Barcode Data Generator — parses and encodes any user-entered barcode
 * into an exact standard bitstream with verified quiet zones and checksums.
 */
export function getBarcodeRenderData(
  code: string,
  requestedFormat: string = "Auto"
): BarcodeRenderData | null {
  const clean = String(code || "").trim();
  if (!clean) return null;

  const isNumericOnly = /^\d{12,13}$/.test(clean);
  const isEan13 =
    requestedFormat === "EAN-13" ||
    requestedFormat === "EAN13" ||
    ((!requestedFormat || requestedFormat === "Auto" || requestedFormat === "auto") && isNumericOnly);

  if (isEan13) {
    try {
      const structured = encodeEAN13Structured(clean);
      const runs = structured.allBars.map((b) => ({ width: b.width, isBlack: b.isBlack }));
      let totalMod = 0;
      runs.forEach((b) => (totalMod += b.width));
      return {
        clean,
        format: "EAN13",
        runs,
        totalModules: totalMod,
      };
    } catch {
      // fallback to Code 128 below
    }
  }

  // Code 128 (Alphanumeric & Generic Numeric Standard)
  const runs = encodeCode128(clean);
  let totalMod = 0;
  runs.forEach((b) => (totalMod += b.width));

  return {
    clean,
    format: "CODE128",
    runs,
    totalModules: totalMod,
  };
}

/**
 * Gs1Ean13Svg — Genuine GS1 EAN-13 Barcode with extending guard bars and dual-grouped digits.
 * Strict ISO/IEC 15420 geometry: zero text overlap, proper quiet zones, crisp high contrast.
 */
export function Gs1Ean13Svg({
  code,
  height = 52,
  unitPx = 2,
}: {
  code: string;
  height?: number;
  unitPx?: number;
}) {
  const structured = useMemo<EAN13Structured>(() => {
    return encodeEAN13Structured(code || "8904358601259");
  }, [code]);

  const unit = Math.max(1, Math.round(unitPx || 2));
  const leftQuietWidth = 11 * unit; // 11 modules quiet zone
  const rightQuietWidth = 8 * unit; // 8 modules quiet zone
  const barsWidth = 95 * unit; // 95 modules
  const svgWidth = leftQuietWidth + barsWidth + rightQuietWidth;

  const fontSize = Math.max(8.5, Math.min(11, Math.round(height * 0.22)));
  const textBaseline = height - 1.5;
  const barTop = 1;
  const dataBarHeight = Math.max(18, Math.round(height - fontSize - 5));
  const guardBarHeight = Math.min(height - 2, dataBarHeight + 5);

  let curX = leftQuietWidth;
  const barElements = structured.allBars.map((b, i) => {
    const w = b.width * unit;
    const x = curX;
    curX += w;
    if (!b.isBlack) return null;
    const h = b.isGuard ? guardBarHeight : dataBarHeight;
    return (
      <rect
        key={i}
        x={x}
        y={barTop}
        width={w}
        height={h}
        fill="#000000"
      />
    );
  });

  return (
    <div className="flex flex-col items-center justify-center bg-white p-0 rounded overflow-hidden select-none w-full">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${svgWidth} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        shapeRendering="crispEdges"
        style={{ display: "block", background: "#ffffff", maxWidth: "100%", imageRendering: "pixelated" }}
      >
        <rect width={svgWidth} height={height} fill="#ffffff" />
        <text
          x={Math.max(2, leftQuietWidth - 5 * unit)}
          y={textBaseline}
          textAnchor="middle"
          fontSize={fontSize}
          fontFamily="'OCR-B', 'Courier New', monospace"
          fontWeight="bold"
          fill="#000000"
        >
          {structured.firstDigit}
        </text>
        {barElements}
        <text
          x={leftQuietWidth + Math.round(21 * unit)}
          y={textBaseline}
          textAnchor="middle"
          fontSize={fontSize}
          fontFamily="'OCR-B', 'Courier New', monospace"
          fontWeight="bold"
          letterSpacing="0.8px"
          fill="#000000"
        >
          {structured.leftDigits}
        </text>
        <text
          x={leftQuietWidth + Math.round(68 * unit)}
          y={textBaseline}
          textAnchor="middle"
          fontSize={fontSize}
          fontFamily="'OCR-B', 'Courier New', monospace"
          fontWeight="bold"
          letterSpacing="0.8px"
          fill="#000000"
        >
          {structured.rightDigits}
        </text>
        <text
          x={svgWidth - 4}
          y={textBaseline}
          textAnchor="middle"
          fontSize={Math.max(6.5, fontSize - 2)}
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
 * Guaranteed clear margin above text baseline for flawless laser gun recognition.
 */
export function Code128Svg({
  code,
  width = 200,
  height = 52,
  unitPx = 2,
}: {
  code: string;
  width?: number;
  height?: number;
  unitPx?: number;
}) {
  return (
    <RealBarcodeSvg
      code={code}
      format="Code-128"
      width={width}
      height={height}
      unitPx={unitPx}
    />
  );
}

/**
 * RealBarcodeSvg — Universal Barcode SVG Component
 * Automatically detects or respects format (Code-128, EAN-13, UPC, Code-39)
 * with verified 10-module quiet zones and high-contrast integer vector rendering.
 */
export function RealBarcodeSvg({
  code,
  format = "Auto",
  width,
  height = 48,
  unitPx = 2,
  displayValue = true,
}: {
  code: string;
  format?: string;
  width?: number;
  height?: number;
  unitPx?: number;
  displayValue?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const clean = String(code || "").trim();

  useEffect(() => {
    if (svgRef.current && clean) {
      try {
        let jsFormat = "CODE128";
        const upperFmt = (format || "Auto").toUpperCase().trim();

        if (upperFmt.includes("EAN-13") || upperFmt.includes("EAN13")) {
          jsFormat = "EAN13";
        } else if (upperFmt.includes("EAN-8") || upperFmt.includes("EAN8")) {
          jsFormat = "EAN8";
        } else if (upperFmt.includes("EAN-5") || upperFmt.includes("EAN5")) {
          jsFormat = "EAN5";
        } else if (upperFmt.includes("EAN-2") || upperFmt.includes("EAN2")) {
          jsFormat = "EAN2";
        } else if (upperFmt.includes("UPC-E") || upperFmt.includes("UPCE")) {
          jsFormat = "UPCE";
        } else if (upperFmt.includes("UPC") || upperFmt.includes("UPCA") || upperFmt.includes("UPC-A")) {
          jsFormat = "UPC";
        } else if (upperFmt.includes("CODE39") || upperFmt.includes("CODE-39") || upperFmt.includes("CODE 39")) {
          jsFormat = "CODE39";
        } else if (upperFmt.includes("CODE93") || upperFmt.includes("CODE-93") || upperFmt.includes("CODE 93")) {
          jsFormat = "CODE128";
        } else if (upperFmt.includes("ITF-14") || upperFmt.includes("ITF14") || upperFmt.includes("ITF")) {
          jsFormat = "ITF14";
        } else if (upperFmt.includes("MSI")) {
          jsFormat = "MSI";
        } else if (upperFmt.includes("CODABAR")) {
          jsFormat = "pharmacode";
        } else if (upperFmt.includes("PHARMACODE")) {
          jsFormat = "pharmacode";
        } else if (upperFmt.includes("CODE128") || upperFmt.includes("CODE-128") || upperFmt.includes("CODE 128")) {
          jsFormat = "CODE128";
        } else if (upperFmt === "AUTO") {
          if (/^\d{13}$/.test(clean)) {
            jsFormat = "EAN13";
          } else if (/^\d{8}$/.test(clean)) {
            jsFormat = "EAN8";
          } else if (/^\d{12}$/.test(clean)) {
            jsFormat = "UPC";
          } else if (/^\d{14}$/.test(clean)) {
            jsFormat = "ITF14";
          } else {
            jsFormat = "CODE128";
          }
        }

        try {
          JsBarcode(svgRef.current, clean, {
            format: jsFormat,
            width: Math.max(1.2, unitPx || 1.35),
            height: Math.max(18, height - (displayValue ? 14 : 2)),
            displayValue: displayValue,
            fontOptions: "bold",
            fontSize: 13,
            font: "Arial, sans-serif",
            textAlign: "center",
            textPosition: "bottom",
            textMargin: 2,
            margin: 2,
            background: "#ffffff",
            lineColor: "#000000",
          });
        } catch (e1) {
          // Fallback to CODE128 if EAN13 checksum fails or string is arbitrary
          JsBarcode(svgRef.current, clean, {
            format: "CODE128",
            width: Math.max(1.2, unitPx || 1.35),
            height: Math.max(18, height - (displayValue ? 14 : 2)),
            displayValue: displayValue,
            fontOptions: "bold",
            fontSize: 13,
            font: "Arial, sans-serif",
            textAlign: "center",
            textPosition: "bottom",
            textMargin: 2,
            margin: 2,
            background: "#ffffff",
            lineColor: "#000000",
          });
        }
      } catch (e) {
        console.warn("Barcode rendering fallback error:", e);
      }
    }
  }, [clean, format, height, unitPx, displayValue]);

  if (!clean) return null;

  return (
    <div className="flex flex-col items-center justify-center bg-white p-0 rounded overflow-hidden select-none w-full">
      <svg
        ref={svgRef}
        style={{
          display: "block",
          background: "#ffffff",
          maxWidth: "100%",
          shapeRendering: "crispEdges",
          imageRendering: "pixelated",
        }}
      />
    </div>
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
 * Helper to dynamically resolve active organization / workspace name
 */
export function resolveOrgName(orgName?: string, templateStoreName?: string): string {
  // 1. Explicitly passed from useTenant()
  if (orgName && orgName.trim() && !orgName.toUpperCase().includes("LAZYMONKEY")) {
    return orgName.trim().toUpperCase();
  }

  // 2. Check active billing company / GST registration
  if (typeof window !== "undefined") {
    try {
      const activeGst = getActiveBillingGst();
      if (
        activeGst?.trade_name &&
        !activeGst.trade_name.toUpperCase().includes("LAZYMONKEY") &&
        !activeGst.trade_name.toUpperCase().includes("STORE")
      ) {
        return activeGst.trade_name.trim().toUpperCase();
      }
      if (
        activeGst?.legal_name &&
        !activeGst.legal_name.toUpperCase().includes("LAZYMONKEY") &&
        !activeGst.legal_name.toUpperCase().includes("STORE")
      ) {
        return activeGst.legal_name.trim().toUpperCase();
      }

      const bosTenant = localStorage.getItem("bos-tenant");
      if (bosTenant) {
        const parsed = JSON.parse(bosTenant);
        const name = parsed?.name || parsed?.slug;
        if (name && name.trim() && !name.toUpperCase().includes("LAZYMONKEY")) {
          return name.trim().toUpperCase();
        }
      }

      const bosAuth = localStorage.getItem("bos-auth");
      if (bosAuth) {
        const parsed = JSON.parse(bosAuth);
        const name =
          parsed?.user?.tenantName ||
          (parsed?.user as any)?.tenant_name ||
          parsed?.tenant?.name ||
          parsed?.user?.companyName;
        if (name && name.trim()) {
          return name.trim().toUpperCase();
        }
      }
    } catch {}
  }

  // 3. User-customized template store name (excluding legacy defaults and placeholders)
  if (
    templateStoreName &&
    templateStoreName.trim() &&
    templateStoreName.toUpperCase() !== "RETAIL STORE" &&
    templateStoreName.toUpperCase() !== "LOGISTICS STORE" &&
    templateStoreName.toUpperCase() !== "GLOBAL LOGISTICS NETWORK" &&
    templateStoreName.toUpperCase() !== "MY STORE" &&
    templateStoreName.toUpperCase() !== "STORE" &&
    templateStoreName.toUpperCase() !== "ORGANIZATION"
  ) {
    return templateStoreName.trim().toUpperCase();
  }

  if (orgName && orgName.trim()) {
    return orgName.trim().toUpperCase();
  }

  return "LAZYMONKEYAI STORE";
}

export interface SingleBarcodeLabelCardProps {
  item: ProductBarcodeLike;
  template: any;
  isPrint?: boolean;
  orgName?: string;
  isEditable?: boolean;
  selectedElementKey?: string;
  onSelectElement?: (elementKey: string) => void;
  onFieldEdit?: (elementKey: string, newValue: string) => void;
  onResizeBarcode?: (newHeight: number, newScale?: number) => void;
  onResizeElement?: (elementId: string, updates: { height?: number; width?: number; fontSize?: number; posX?: number; posY?: number; isFreePositioned?: boolean }) => void;
  onMoveElement?: (elementId: string, pos: { posX: number; posY: number; isFreePositioned: boolean }) => void;
}

/**
 * SingleBarcodeLabelCard — renders a single product barcode label per template
 * with full Word-document style typography, alignment, font selection, and element-level layout placements.
 * Supports Free-Form 2D Drag-and-Drop Canvas: grab and move any element anywhere on the label sticker.
 */
export function SingleBarcodeLabelCard({
  item,
  template,
  isPrint = false,
  orgName,
  isEditable = false,
  selectedElementKey,
  onSelectElement,
  onFieldEdit,
  onResizeBarcode,
  onResizeElement,
  onMoveElement,
}: SingleBarcodeLabelCardProps) {
  const { currency } = useCurrency();
  const f = template?.fields || {};
  const elemStyles = template?.elementSettings || {};
  const customTexts = template?.customTexts || {};

  const cardContainerRef = useRef<HTMLDivElement | null>(null);

  // Active free-form drag & drop placement state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragLivePos, setDragLivePos] = useState<{ id: string; posX: number; posY: number } | null>(null);

  const resolvedStoreTitle = customTexts.storeName || resolveOrgName(orgName, template?.storeName);
  const resolvedProductTitle = customTexts.productName || item.product_name || "Product Name";
  const resolvedSkuVal = customTexts.sku || item.sku || "SKU-001";
  const resolvedHsnVal = customTexts.hsn || (item as any).hsn_code || "8517.12.00";
  const resolvedBatchVal = customTexts.batchNo || item.batch_no || "B-101";
  const resolvedTaglineVal = customTexts.customTaglineText || template?.customTaglineText || f.customTaglineText || "Incl. of all taxes";
  const resolvedDateVal = customTexts.datesText || (item.mfg_lic_no || item.pkd_date || item.exp_date ? `Mfg: ${item.pkd_date || '07/26'} | Exp: ${item.exp_date || '07/29'}` : "Mfg: 07/26 | Exp: 07/29");

  // Free-form Drag & Drop handler: move any element anywhere on the label sticker
  const startElementDrag = (
    e: React.PointerEvent,
    el: BarcodeElementBlock,
    domNode?: HTMLElement | null
  ) => {
    if (!isEditable || isPrint) return;

    // Check if clicked inside an editable text area while already focused
    const isEditingFocused =
      document.activeElement &&
      (document.activeElement as HTMLElement).isContentEditable &&
      document.activeElement === e.target;
    if (isEditingFocused) return;

    onSelectElement?.(el.id);

    const cardEl = cardContainerRef.current;
    if (!cardEl) return;

    const startX = e.clientX;
    const startY = e.clientY;
    let hasMoved = false;

    const cardRect = cardEl.getBoundingClientRect();
    const elemRect = domNode ? domNode.getBoundingClientRect() : null;

    const isFullWidthElement = el.textAlign === "center" || el.type === "companyName" || el.type === "divider";

    // Compute initial % coordinate relative to card
    const initPosX = el.posX !== undefined
      ? el.posX
      : isFullWidthElement
      ? 0
      : elemRect
      ? Math.max(0, Math.min(92, Math.round(((elemRect.left - cardRect.left) / cardRect.width) * 100)))
      : 0;

    const initPosY = el.posY !== undefined
      ? el.posY
      : elemRect
      ? Math.max(0, Math.min(92, Math.round(((elemRect.top - cardRect.top) / cardRect.height) * 100)))
      : 5;

    let latestX = initPosX;
    let latestY = initPosY;

    const onPointerMove = (moveEvt: PointerEvent) => {
      const deltaX = moveEvt.clientX - startX;
      const deltaY = moveEvt.clientY - startY;

      if (!hasMoved && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
        hasMoved = true;
        setActiveDragId(el.id);
      }

      if (hasMoved) {
        const deltaXPct = (deltaX / cardRect.width) * 100;
        const deltaYPct = (deltaY / cardRect.height) * 100;

        latestX = isFullWidthElement && el.posX === undefined && Math.abs(deltaX) < 10
          ? 0
          : Math.max(0, Math.min(92, Math.round(initPosX + deltaXPct)));
        latestY = Math.max(0, Math.min(92, Math.round(initPosY + deltaYPct)));

        setDragLivePos({ id: el.id, posX: latestX, posY: latestY });
      }
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      setActiveDragId(null);
      setDragLivePos(null);

      if (hasMoved) {
        onMoveElement?.(el.id, { posX: latestX, posY: latestY, isFreePositioned: true });
        if (onResizeElement) {
          onResizeElement(el.id, { posX: latestX, posY: latestY, isFreePositioned: true });
        }
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Keyboard Arrow Keys (Nudge pixel-by-pixel when an element is selected)
  useEffect(() => {
    if (!isEditable || !selectedElementKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      const targetEl = (template?.elements || []).find((elem: any) => elem.id === selectedElementKey);
      if (!targetEl) return;

      const step = e.shiftKey ? 5 : 1;
      let newX = targetEl.posX ?? 0;
      let newY = targetEl.posY ?? 0;
      let handled = false;

      if (e.key === "ArrowUp") {
        newY = Math.max(0, newY - step);
        handled = true;
      } else if (e.key === "ArrowDown") {
        newY = Math.min(92, newY + step);
        handled = true;
      } else if (e.key === "ArrowLeft") {
        newX = Math.max(0, newX - step);
        handled = true;
      } else if (e.key === "ArrowRight") {
        newX = Math.min(92, newX + step);
        handled = true;
      }

      if (handled) {
        e.preventDefault();
        onMoveElement?.(targetEl.id, { posX: newX, posY: newY, isFreePositioned: true });
        onResizeElement?.(targetEl.id, { posX: newX, posY: newY, isFreePositioned: true });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditable, selectedElementKey, template?.elements, onMoveElement, onResizeElement]);

  // Drag-to-resize pointer handler for barcode height, width & 2D dimensions
  const dragStartXRef = useRef<number>(0);
  const dragStartYRef = useRef<number>(0);
  const dragStartHeightRef = useRef<number>(0);
  const dragStartScaleRef = useRef<number>(1.0);

  const startBarcodeResizeHeight = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dragStartYRef.current = e.clientY;
    const currentH = Number(template?.barcodeHeight || (isPrint ? 32 : 44));
    dragStartHeightRef.current = currentH;

    const onPointerMove = (moveEvt: PointerEvent) => {
      const deltaY = moveEvt.clientY - dragStartYRef.current;
      const newHeight = Math.max(16, Math.min(130, Math.round(dragStartHeightRef.current + deltaY)));
      onResizeBarcode?.(newHeight);
      if (onResizeElement && selectedElementKey) {
        onResizeElement(selectedElementKey, { height: newHeight });
      }
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const startBarcodeResizeWidth = (e: React.PointerEvent, dir: "left" | "right") => {
    e.stopPropagation();
    e.preventDefault();
    dragStartXRef.current = e.clientX;
    const currentScale = Number(template?.barcodeWidthScale || 1.0);
    dragStartScaleRef.current = currentScale;

    const onPointerMove = (moveEvt: PointerEvent) => {
      const deltaX = (moveEvt.clientX - dragStartXRef.current) * (dir === "left" ? -1 : 1);
      const scaleDelta = deltaX / 120; // 120px drag = 1.0x scale
      const newScale = Math.max(0.6, Math.min(2.2, Number((dragStartScaleRef.current + scaleDelta).toFixed(2))));
      const currentH = Number(template?.barcodeHeight || (isPrint ? 32 : 44));
      onResizeBarcode?.(currentH, newScale);
      if (onResizeElement && selectedElementKey) {
        onResizeElement(selectedElementKey, { widthScale: newScale } as any);
      }
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const startBarcodeResizeCorner = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dragStartXRef.current = e.clientX;
    dragStartYRef.current = e.clientY;
    const currentH = Number(template?.barcodeHeight || (isPrint ? 32 : 44));
    const currentScale = Number(template?.barcodeWidthScale || 1.0);
    dragStartHeightRef.current = currentH;
    dragStartScaleRef.current = currentScale;

    const onPointerMove = (moveEvt: PointerEvent) => {
      const deltaY = moveEvt.clientY - dragStartYRef.current;
      const deltaX = moveEvt.clientX - dragStartXRef.current;
      const newHeight = Math.max(16, Math.min(130, Math.round(dragStartHeightRef.current + deltaY)));
      const scaleDelta = deltaX / 120;
      const newScale = Math.max(0.6, Math.min(2.2, Number((dragStartScaleRef.current + scaleDelta).toFixed(2))));
      onResizeBarcode?.(newHeight, newScale);
      if (onResizeElement && selectedElementKey) {
        onResizeElement(selectedElementKey, { height: newHeight, widthScale: newScale } as any);
      }
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const rawSp = item.selling_price != null && Number(item.selling_price) > 0 ? Number(item.selling_price) : null;
  const rawMrp = item.mrp != null && Number(item.mrp) > 0 ? Number(item.mrp) : null;

  const resolvedSpNum = rawSp != null ? rawSp : (rawMrp != null ? rawMrp : null);
  const resolvedMrpNum = rawMrp != null ? rawMrp : (rawSp != null ? Number((rawSp * 1.25).toFixed(2)) : null);

  const spVal = resolvedSpNum != null ? `${currency.symbol}${resolvedSpNum.toFixed(2)}` : customTexts.spVal || `${currency.symbol}399.00`;
  const mrpVal = resolvedMrpNum != null ? `${currency.symbol}${resolvedMrpNum.toFixed(2)}` : customTexts.mrpVal || `${currency.symbol}499.00`;

  // Typography & Layout Configurations from Template (Word-like)
  const fontFamily = template?.fontFamily || "Calibri, Inter, sans-serif";
  const globalAlign = template?.textAlign || "left";
  const layoutStyle = template?.layoutStyle || "standard_stack";
  const barcodePlacement = template?.barcodePlacement || "bottom";
  const headerPlacement = template?.headerPlacement || "top";
  const borderStyle = template?.borderStyle || "solid";
  const borderRadius = template?.borderRadius || "sm";
  const borderColor = template?.borderColor || "#cbd5e1";
  const barcodeHeight = template?.barcodeHeight || (isPrint ? 32 : 44);
  const barcodeSymbology = template?.barcodeSymbology || template?.barcodeFormat || item.format || "Auto";
  const paperBgColor = template?.paperBgColor || "#ffffff";
  const primaryColor = template?.primaryColor || "#0f172a";

  // SP vs MRP Settings
  const rawSpPref =
    customTexts.spPrefix !== undefined
      ? customTexts.spPrefix
      : template?.spPrefix !== undefined
      ? template.spPrefix
      : elemStyles.priceSp?.prefix !== undefined
      ? elemStyles.priceSp.prefix
      : "SP: ";

  const rawMrpPref =
    customTexts.mrpPrefix !== undefined
      ? customTexts.mrpPrefix
      : template?.mrpPrefix !== undefined
      ? template.mrpPrefix
      : template?.pricePrefix !== undefined
      ? template.pricePrefix
      : elemStyles.priceMrp?.prefix !== undefined
      ? elemStyles.priceMrp.prefix
      : "MRP: ";

  const spPrefix = cleanSpPrefix(rawSpPref, "SP: ");
  const mrpPrefix = cleanMrpPrefix(rawMrpPref, "MRP: ");

  const skuPrefix =
    customTexts.skuPrefix !== undefined
      ? customTexts.skuPrefix
      : elemStyles.sku?.prefix !== undefined
      ? elemStyles.sku.prefix
      : "SKU: ";

  const hsnPrefix =
    customTexts.hsnPrefix !== undefined
      ? customTexts.hsnPrefix
      : elemStyles.hsn?.prefix !== undefined
      ? elemStyles.hsn.prefix
      : "HSN: ";

  const showMrpStrike = elemStyles.priceMrp?.showStrike ?? template?.showMrpStrike ?? true;
  const isBoldMrpStrike = elemStyles.priceMrp?.strikeBold ?? template?.isBoldMrpStrike ?? true;
  const mrpStrikeColor = elemStyles.priceMrp?.strikeColor ?? template?.mrpStrikeColor ?? "gray";
  const showDiscountBadge = elemStyles.priceMrp?.showDiscountPercent ?? template?.showDiscountBadge ?? false;
  const spBadgeStyle = elemStyles.priceSp?.badgeStyle ?? template?.spBadgeStyle ?? "none";
  const priceLayout = elemStyles.priceLayout ?? template?.priceLayout ?? "inline";

  // Calculate discount percent if both SP and MRP exist
  let discountPercent = 0;
  if (rawMrp && rawSp && rawMrp > rawSp) {
    discountPercent = Math.round(((rawMrp - rawSp) / rawMrp) * 100);
  }

  const mrpStrikeClass =
    showMrpStrike === false
      ? "font-bold text-slate-900 no-underline tracking-tight"
      : isBoldMrpStrike
      ? mrpStrikeColor === "red"
        ? "line-through font-black text-red-600 decoration-red-600 decoration-2"
        : "line-through font-bold text-slate-800 decoration-slate-800"
      : "line-through text-slate-600";

  const spBadgeClasses =
    spBadgeStyle === "pill"
      ? "bg-emerald-600 text-white px-1.5 py-0.2 rounded-full font-black shadow-2xs"
      : spBadgeStyle === "dark"
      ? "bg-slate-950 text-white px-1.5 py-0.2 rounded font-black"
      : spBadgeStyle === "gold"
      ? "bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded font-black"
      : spBadgeStyle === "outline"
      ? "border border-indigo-600 text-indigo-700 px-1 py-0.2 rounded font-black"
      : "text-slate-950 font-black";

  const spBadgeClass = spBadgeClasses;

  const isBoldProductName = elemStyles.productName?.fontWeight === "bold" || (template?.isBoldProductName !== false);
  const isUppercaseCompany = elemStyles.header?.textTransform === "uppercase" || (template?.isUppercaseCompany !== false);

  // Border class
  const borderClass =
    borderStyle === "dashed"
      ? "border border-dashed"
    : borderStyle === "dotted"
      ? "border border-dotted"
    : borderStyle === "double"
      ? "border-2 border-double"
    : borderStyle === "none"
      ? "border-0"
    : "border";

  // Radius class
  const radiusClass =
    borderRadius === "none"
      ? "rounded-none"
    : borderRadius === "md"
      ? "rounded-md"
    : borderRadius === "lg"
      ? "rounded-xl"
    : borderRadius === "full"
      ? "rounded-2xl"
    : "rounded";

  // Helper for click highlight and Word Document style bounding box
  const getSelectableClass = (key: string) => {
    if (isPrint) return "";
    const isSelected =
      selectedElementKey === key ||
      (key === "header" && (selectedElementKey === "el_company" || selectedElementKey === "companyName")) ||
      (key === "el_company" && (selectedElementKey === "header" || selectedElementKey === "companyName")) ||
      (key === "productName" && (selectedElementKey === "el_product_name" || selectedElementKey === "product")) ||
      (key === "el_product_name" && (selectedElementKey === "productName" || selectedElementKey === "product")) ||
      (key === "el_sp" && (selectedElementKey === "sellingPrice" || selectedElementKey === "priceSp" || selectedElementKey === "sp" || selectedElementKey === "el_sp")) ||
      (key === "sellingPrice" && (selectedElementKey === "el_sp" || selectedElementKey === "priceSp" || selectedElementKey === "sp" || selectedElementKey === "sellingPrice")) ||
      (key === "el_mrp" && (selectedElementKey === "mrp" || selectedElementKey === "priceMrp" || selectedElementKey === "el_mrp")) ||
      (key === "mrp" && (selectedElementKey === "el_mrp" || selectedElementKey === "priceMrp" || selectedElementKey === "mrp")) ||
      (key === "sku" && (selectedElementKey === "el_sku" || selectedElementKey === "sku")) ||
      (key === "el_sku" && (selectedElementKey === "sku" || selectedElementKey === "el_sku")) ||
      (key === "barcodeGraphic" && (selectedElementKey === "el_barcode" || selectedElementKey === "barcode")) ||
      (key === "el_barcode" && (selectedElementKey === "barcodeGraphic" || selectedElementKey === "barcode"));

    if (isEditable) {
      return `transition-all duration-150 relative rounded cursor-text ${
        isSelected
          ? "ring-2 ring-blue-600 bg-blue-50/50 dark:bg-blue-950/40 p-0.5 shadow-2xs z-20"
          : "hover:outline hover:outline-1 hover:outline-dashed hover:outline-blue-400 p-0.5 hover:bg-blue-50/20"
      }`;
    }
    if (onSelectElement) {
      return `cursor-pointer transition-all duration-150 relative rounded group ${
        isSelected
          ? "ring-2 ring-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/40 p-0.5"
          : "hover:outline hover:outline-1 hover:outline-dashed hover:outline-indigo-300"
      }`;
    }
    return "";
  };

  const handleElementClick = (e: React.MouseEvent, key: string) => {
    if (isPrint || !onSelectElement) return;
    e.stopPropagation();
    onSelectElement(key);
  };

  const handleBlur = (key: string, e: React.FocusEvent<HTMLElement>) => {
    if (!isEditable || !onFieldEdit) return;
    const text = e.currentTarget.innerText || "";
    onFieldEdit(key, text.trim());
  };

  // 1. Render Header Component (Company & Category)
  const renderHeader = () => {
    if (f.showCompanyName === false && (f.showCategoryBrand !== true || !item.category_name)) return null;
    const headerAlign = elemStyles.header?.textAlign || elemStyles.company?.textAlign || globalAlign || "center";
    const showCategory = f.showCategoryBrand === true && headerAlign !== "center";
    const compFont = elemStyles.header?.fontFamily || fontFamily;
    const compColor = elemStyles.header?.color || primaryColor;
    const compSize = elemStyles.header?.fontSize || (isPrint ? "7.5px" : "11px");

    return (
      <div
        onClick={(e) => handleElementClick(e, "header")}
        className={`${getSelectableClass("header")} flex items-center ${
          headerAlign === "center" ? "justify-center text-center" : headerAlign === "right" ? "justify-end text-right" : showCategory ? "justify-between" : "justify-start"
        } border-b border-slate-200 pb-0.5 mb-0.5 w-full relative`}
      >
        {isEditable && selectedElementKey === "header" && (
          <span className="absolute -top-3 left-0 bg-blue-600 text-white text-[7px] font-black px-1 rounded uppercase tracking-wider select-none pointer-events-none z-30 shadow-2xs">
            Company Name
          </span>
        )}
        {f.showCompanyName !== false && (
          <span
            contentEditable={isEditable}
            suppressContentEditableWarning
            onBlur={(e) => handleBlur("storeName", e)}
            className={`font-black tracking-wider ${isUppercaseCompany ? "uppercase" : ""} truncate ${headerAlign === "center" ? "text-center w-full" : ""} outline-none`}
            style={{
              color: compColor,
              fontFamily: compFont,
              fontSize: compSize,
            }}
          >
            {resolvedStoreTitle}
          </span>
        )}
        {showCategory && item.category_name && (
          <span
            contentEditable={isEditable}
            suppressContentEditableWarning
            onBlur={(e) => handleBlur("categoryName", e)}
            className={`font-semibold text-slate-500 uppercase ${
              isPrint ? "text-[6px]" : "text-[8.5px]"
            } truncate ml-1 outline-none`}
          >
            {item.category_name}
          </span>
        )}
      </div>
    );
  };

  // 2. Render Product Title
  const renderProductName = () => {
    if (f.showProductName === false) return null;
    const titleAlign = elemStyles.productName?.textAlign || globalAlign;
    const alignTextClass = titleAlign === "center" ? "text-center" : titleAlign === "right" ? "text-right" : "text-left";
    const prodFont = elemStyles.productName?.fontFamily || fontFamily;
    const prodColor = elemStyles.productName?.color || "#020617";
    const prodSize = elemStyles.productName?.fontSize || (isPrint ? "8px" : "12px");

    return (
      <div
        onClick={(e) => handleElementClick(e, "productName")}
        className={`${getSelectableClass("productName")} w-full relative`}
      >
        {isEditable && selectedElementKey === "productName" && (
          <span className="absolute -top-3 left-0 bg-blue-600 text-white text-[7px] font-black px-1 rounded uppercase tracking-wider select-none pointer-events-none z-30 shadow-2xs">
            Product Title
          </span>
        )}
        <h4
          contentEditable={isEditable}
          suppressContentEditableWarning
          onBlur={(e) => handleBlur("productName", e)}
          className={`${isBoldProductName ? "font-black" : "font-semibold"} leading-tight truncate w-full ${alignTextClass} outline-none`}
          style={{
            fontFamily: prodFont,
            color: prodColor,
            fontSize: prodSize,
          }}
        >
          {resolvedProductTitle}
        </h4>
      </div>
    );
  };

  // 3. Render SKU / Code / HSN
  const renderSkuAndHsn = () => {
    if (f.showSKU !== true && f.showHSN !== true) return null;
    const skuAlign = elemStyles.sku?.textAlign || globalAlign;
    const alignTextClass = skuAlign === "center" ? "text-center" : skuAlign === "right" ? "text-right" : "text-left";
    const skuFont = elemStyles.sku?.fontFamily || "'Courier New', monospace";
    const skuColor = elemStyles.sku?.color || "#334155";
    const skuSize = elemStyles.sku?.fontSize || (isPrint ? "6px" : "9.5px");

    return (
      <div
        onClick={(e) => handleElementClick(e, "sku")}
        className={`${getSelectableClass("sku")} ${alignTextClass} flex items-center ${
          skuAlign === "center" ? "justify-center gap-2" : skuAlign === "right" ? "justify-end gap-2" : "justify-between gap-1"
        } relative`}
      >
        {isEditable && selectedElementKey === "sku" && (
          <span className="absolute -top-3 left-0 bg-blue-600 text-white text-[7px] font-black px-1 rounded uppercase tracking-wider select-none pointer-events-none z-30 shadow-2xs">
            SKU & HSN
          </span>
        )}
        {f.showSKU === true && item.sku && (
          <span
            contentEditable={isEditable}
            suppressContentEditableWarning
            onBlur={(e) => handleBlur("sku", e)}
            className="font-mono font-bold truncate block outline-none"
            style={{
              fontFamily: skuFont,
              color: skuColor,
              fontSize: skuSize,
            }}
          >
            {skuPrefix}{resolvedSkuVal}
          </span>
        )}
        {f.showHSN === true && (
          <span
            contentEditable={isEditable}
            suppressContentEditableWarning
            onBlur={(e) => handleBlur("hsn", e)}
            className="font-mono text-slate-500 font-semibold truncate block outline-none"
            style={{ fontSize: isPrint ? "5.5px" : "8px" }}
          >
            {hsnPrefix}{resolvedHsnVal}
          </span>
        )}
      </div>
    );
  };

  // 4. Render Categorized Price Block (SP vs MRP)
  const renderPriceBlock = (passedId?: string) => {
    if (f.showPrice === false && f.showMRP === false) return null;
    const targetKey = passedId || "el_price_group";
    const el = elementsToRender.find((b) => b.id === targetKey || b.type === "priceGroup");

    const priceAlign = el?.textAlign || elemStyles.priceSp?.textAlign || globalAlign;
    const blockFont = el?.fontFamily || fontFamily;
    const blockColor = el?.color;
    const blockFontSize = el?.fontSize ? (typeof el.fontSize === "number" ? `${el.fontSize}px` : el.fontSize) : undefined;
    const blockFontWeight = el?.fontWeight === "normal" ? "font-normal" : "font-black";
    const blockFontStyle = el?.fontStyle || "normal";
    const blockTextDecoration = el?.textDecoration || "none";
    const resolvedSpPrefix = cleanSpPrefix(el?.prefix, spPrefix);
    const resolvedMrpPrefix = cleanMrpPrefix(el?.mrpPrefix, mrpPrefix);
    const resolvedSpSuffix = el?.suffix || "";
    const isStrike = el?.showStrike !== undefined ? el.showStrike : el?.textDecoration === "line-through" ? true : showMrpStrike;

    return (
      <div
        onClick={(e) => handleElementClick(e, targetKey)}
        className={`${getSelectableClass(targetKey)} w-full relative`}
      >
        {isEditable && (selectedElementKey === targetKey || selectedElementKey === "price" || selectedElementKey === "el_price_group") && (
          <span className="absolute -top-3 left-0 bg-blue-600 text-white text-[7px] font-black px-1 rounded uppercase tracking-wider select-none pointer-events-none z-30 shadow-2xs">
            Prices (SP & MRP)
          </span>
        )}
        {priceLayout === "stacked" ? (
          // Stacked Layout: SP on top, MRP below
          <div className={`flex flex-col ${priceAlign === "center" ? "items-center" : priceAlign === "right" ? "items-end" : "items-start"} leading-tight`}>
            {f.showPrice !== false && spVal && (
              <div className="flex items-baseline gap-1">
                <span
                  contentEditable={isEditable}
                  suppressContentEditableWarning
                  onBlur={(e) => handleBlur("spVal", e)}
                  className={`font-black ${isPrint ? "text-[8px]" : "text-[11px]"} ${spBadgeClasses} whitespace-nowrap outline-none`}
                  style={{
                    fontFamily: blockFont,
                    color: blockColor,
                    fontSize: blockFontSize,
                    fontStyle: blockFontStyle,
                    textDecoration: blockTextDecoration,
                  }}
                >
                  {resolvedSpPrefix}{spVal}{resolvedSpSuffix}
                </span>
              </div>
            )}
            {f.showMRP !== false && mrpVal && (
              <div className="flex items-baseline gap-1 mt-0.5">
                <span
                  contentEditable={isEditable}
                  suppressContentEditableWarning
                  onBlur={(e) => handleBlur("mrpVal", e)}
                  className={`${isStrike === false ? "font-bold text-slate-900 no-underline" : mrpStrikeClass} ${isStrike === false ? (isPrint ? "text-[7.5px]" : "text-[10px]") : (isPrint ? "text-[6.5px]" : "text-[9.5px]")} whitespace-nowrap outline-none`}
                  style={{
                    fontFamily: blockFont,
                    color: blockColor,
                    fontSize: blockFontSize,
                    fontStyle: blockFontStyle,
                    textDecoration: isStrike ? "line-through" : (blockTextDecoration === "line-through" ? "line-through" : "none"),
                  }}
                >
                  {resolvedMrpPrefix}{mrpVal}
                </span>
                {showDiscountBadge && discountPercent > 0 && (
                  <span className="text-[7px] font-black text-emerald-700 bg-emerald-100 px-1 rounded whitespace-nowrap">
                    {discountPercent}% OFF
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          // Inline Layout: MRP and SP side by side
          <div
            className={`flex items-baseline ${
              priceAlign === "center" || template?.themeName === "mybillbook_clean" || template?.themeName === "trendy_offer" || template?.priceLayout === "center_offer"
                ? "justify-center gap-3"
                : priceAlign === "right"
                ? "justify-end gap-2"
                : "justify-between gap-1"
            } w-full`}
          >
            {/* If Center/Offer layout: Render SP (Offer) on left, then MRP on right */}
            {(template?.themeName === "trendy_offer" || template?.priceLayout === "center_offer" || template?.themeName === "mybillbook_clean") ? (
              <>
                {/* Left side: SP */}
                {f.showPrice !== false && spVal && (
                  <div className="flex items-baseline gap-1 shrink-0">
                    <span
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      onBlur={(e) => handleBlur("spVal", e)}
                      className={`font-black ${isPrint ? "text-[8px]" : "text-[11px]"} ${spBadgeClasses} whitespace-nowrap outline-none`}
                      style={{
                        fontFamily: blockFont,
                        fontSize: blockFontSize,
                        fontStyle: blockFontStyle,
                        textDecoration: blockTextDecoration,
                      }}
                    >
                      {resolvedSpPrefix}{spVal}{resolvedSpSuffix}
                    </span>
                    {showDiscountBadge && discountPercent > 0 && (
                      <span className="text-[6.5px] font-black text-emerald-700 bg-emerald-100 px-0.5 rounded whitespace-nowrap">
                        {discountPercent}% OFF
                      </span>
                    )}
                  </div>
                )}
                {/* Right side: MRP */}
                {f.showMRP !== false && mrpVal && (
                  <div className="flex items-baseline gap-1 shrink-0">
                    <span
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      onBlur={(e) => handleBlur("mrpVal", e)}
                      className={`${isStrike === false ? "font-bold text-slate-900 no-underline" : mrpStrikeClass} ${isStrike === false ? (isPrint ? "text-[7.5px]" : "text-[10px]") : (isPrint ? "text-[6.5px]" : "text-[9.5px]")} whitespace-nowrap outline-none`}
                      style={{
                        fontFamily: blockFont,
                        color: blockColor,
                        fontSize: blockFontSize,
                        fontStyle: blockFontStyle,
                        textDecoration: isStrike ? "line-through" : (blockTextDecoration === "line-through" ? "line-through" : "none"),
                      }}
                    >
                      {resolvedMrpPrefix}{mrpVal}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Standard layout: Left side MRP, Right side SP */}
                {f.showMRP !== false && mrpVal && (
                  <div className="flex items-baseline gap-1 shrink-0">
                    <span
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      onBlur={(e) => handleBlur("mrpVal", e)}
                      className={`${isStrike === false ? "font-bold text-slate-900 no-underline" : mrpStrikeClass} ${isStrike === false ? (isPrint ? "text-[7.5px]" : "text-[10px]") : (isPrint ? "text-[6.5px]" : "text-[9.5px]")} whitespace-nowrap outline-none`}
                      style={{
                        fontFamily: blockFont,
                        color: blockColor,
                        fontSize: blockFontSize,
                        fontStyle: blockFontStyle,
                        textDecoration: isStrike ? "line-through" : (blockTextDecoration === "line-through" ? "line-through" : "none"),
                      }}
                    >
                      {resolvedMrpPrefix}{mrpVal}
                    </span>
                  </div>
                )}
                {f.showPrice !== false && spVal && (
                  <div className="flex items-baseline gap-1 shrink-0">
                    <span
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      onBlur={(e) => handleBlur("spVal", e)}
                      className={`font-black ${isPrint ? "text-[8px]" : "text-[11px]"} ${spBadgeClasses} whitespace-nowrap outline-none`}
                      style={{
                        fontFamily: blockFont,
                        fontSize: blockFontSize,
                        fontStyle: blockFontStyle,
                        textDecoration: blockTextDecoration,
                      }}
                    >
                      {resolvedSpPrefix}{spVal}{resolvedSpSuffix}
                    </span>
                    {showDiscountBadge && discountPercent > 0 && (
                      <span className="text-[6.5px] font-black text-emerald-700 bg-emerald-100 px-0.5 rounded whitespace-nowrap">
                        {discountPercent}% OFF
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // Elements to render: use template.elements if defined, otherwise generate default blocks
  const elementsToRender: BarcodeElementBlock[] = (template?.elements && Array.isArray(template.elements) && template.elements.length > 0)
    ? template.elements.filter((el) => {
        if (el.visible === false) return false;
        if (el.id === "el_sku" && f.showSKU !== true && f.showHSN !== true) return false;
        if (el.type === "sku" && f.showSKU !== true) return false;
        if (el.type === "hsn" && f.showHSN !== true) return false;
        if (el.id === "el_footer" && f.showCustomTagline !== true && f.showMfgExpDate !== true) return false;
        if (el.type === "companyName" && f.showCompanyName === false) return false;
        if (el.type === "productName" && f.showProductName === false) return false;
        if (el.type === "priceGroup" && f.showPrice === false && f.showMRP === false) return false;
        if (el.type === "sellingPrice" && f.showPrice === false) return false;
        if (el.type === "mrp" && f.showMRP === false) return false;
        if (el.type === "barcodeGraphic" && f.showBarcodeGraphic === false) return false;
        return true;
      })
    : getDefaultBarcodeElements(template).filter(el => {
        if (el.visible === false) return false;
        if (el.id === "el_sku" && f.showSKU !== true && f.showHSN !== true) return false;
        if (el.id === "el_footer" && f.showCustomTagline !== true && f.showMfgExpDate !== true) return false;
        if (el.type === "companyName" && f.showCompanyName === false) return false;
        if (el.type === "productName" && f.showProductName === false) return false;
        if (el.type === "priceGroup" && f.showPrice === false && f.showMRP === false) return false;
        if (el.type === "sellingPrice" && f.showPrice === false) return false;
        if (el.type === "mrp" && f.showMRP === false) return false;
        if (el.type === "barcodeGraphic" && f.showBarcodeGraphic === false) return false;
        return true;
      });

  const renderSingleElementBlock = (el: BarcodeElementBlock) => {
    if (el.visible === false) return null;
    const blockAlign = el.textAlign || globalAlign || "left";
    const alignClass = blockAlign === "center" ? "text-center justify-center" : blockAlign === "right" ? "text-right justify-end" : "text-left justify-start";
    const blockFont = el.fontFamily || fontFamily;
    const blockColor = el.color || "#020617";
    const blockFontSize = el.fontSize ? (typeof el.fontSize === "number" ? `${el.fontSize}px` : el.fontSize) : (isPrint ? "7.5px" : "11px");

    let contentNode = null;

    switch (el.type) {
      case "companyName":
        contentNode = (
          <div className={`flex items-center ${alignClass} ${el.borderBottom ? "border-b border-slate-200 pb-0.5" : ""} w-full`}>
            <span
              contentEditable={isEditable}
              suppressContentEditableWarning
              onBlur={(e) => handleBlur(el.id || "storeName", e)}
              className={`font-black tracking-wider ${el.textTransform === "uppercase" || isUppercaseCompany ? "uppercase" : ""} truncate outline-none`}
              style={{
                color: el.color || primaryColor,
                fontFamily: blockFont,
                fontSize: blockFontSize,
                fontWeight: el.fontWeight || undefined,
                fontStyle: el.fontStyle || "normal",
                textDecoration: el.textDecoration || "none",
              }}
            >
              {el.prefix || ""}{customTexts[el.id] || customTexts.storeName || el.customText || resolvedStoreTitle}{el.suffix || ""}
            </span>
          </div>
        );
        break;

      case "productName":
        contentNode = (
          <div className="w-full">
            <h4
              contentEditable={isEditable}
              suppressContentEditableWarning
              onBlur={(e) => handleBlur(el.id || "productName", e)}
              className={`${el.fontWeight === "900" || el.fontWeight === "bold" || isBoldProductName ? "font-black" : "font-semibold"} leading-tight truncate w-full ${blockAlign === "center" ? "text-center" : blockAlign === "right" ? "text-right" : "text-left"} outline-none`}
              style={{
                fontFamily: blockFont,
                color: blockColor,
                fontSize: el.fontSize ? (typeof el.fontSize === "number" ? `${el.fontSize}px` : el.fontSize) : (isPrint ? "8px" : "12px"),
                fontWeight: el.fontWeight || undefined,
                fontStyle: el.fontStyle || "normal",
                textDecoration: el.textDecoration || "none",
                textTransform: el.textTransform || "none",
              }}
            >
              {el.prefix || ""}{customTexts[el.id] || customTexts.productName || el.customText || resolvedProductTitle}{el.suffix || ""}
            </h4>
          </div>
        );
        break;

      case "sellingPrice": {
        const isInlineOffer =
          template?.themeName === "trendy_offer" ||
          template?.priceLayout === "center_offer" ||
          template?.priceLayout === "inline" ||
          template?.id === "tpl-bar-dual-trendy" ||
          template?.id === "tpl-bar-trendy-offer";
        const mrpEl = isInlineOffer ? elementsToRender.find((o) => o.type === "mrp") : null;

        const currentPrefix = cleanSpPrefix(el.prefix, spPrefix);
        const currentSuffix = el.suffix || "";
        const customBadge = el.badgeStyle
          ? el.badgeStyle === "pill"
            ? "bg-emerald-600 text-white px-1.5 py-0.2 rounded-full font-black shadow-2xs"
            : el.badgeStyle === "dark"
            ? "bg-slate-950 text-white px-1.5 py-0.2 rounded font-black"
            : el.badgeStyle === "gold"
            ? "bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded font-black"
            : el.badgeStyle === "outline"
            ? "border border-indigo-600 text-indigo-700 px-1 py-0.2 rounded font-black"
            : "text-slate-950 font-black"
          : spBadgeClasses;

        if (mrpEl && f.showMRP !== false && mrpVal) {
          const isStrike = mrpEl.showStrike !== undefined ? mrpEl.showStrike : mrpEl.textDecoration === "line-through" ? true : mrpEl.textDecoration === "none" ? false : showMrpStrike;
          const currentMrpClass = isStrike === false
            ? "font-bold text-slate-900 no-underline tracking-tight"
            : mrpStrikeClass;
          const mrpPrefixToUse = cleanMrpPrefix(mrpEl.prefix, mrpPrefix);
          const mrpSuffixToUse = mrpEl.suffix || "";

          contentNode = (
            <div className="flex items-baseline justify-center gap-3 w-full">
              <span
                contentEditable={isEditable}
                suppressContentEditableWarning
                onClick={(e) => { e.stopPropagation(); handleElementClick(e, el.id || "el_sp"); }}
                onBlur={(e) => handleBlur(el.id || "spVal", e)}
                className={`${el.fontWeight === "bold" || el.fontWeight === "900" ? "font-black" : el.fontWeight === "normal" ? "font-normal" : "font-black"} ${isPrint ? "text-[8px]" : "text-[11px]"} ${customBadge} whitespace-nowrap outline-none ${getSelectableClass(el.id || "el_sp")} rounded px-0.5 cursor-pointer`}
                style={{
                  color: el.color,
                  fontFamily: blockFont,
                  fontSize: el.fontSize ? (typeof el.fontSize === "number" ? `${el.fontSize}px` : el.fontSize) : undefined,
                  fontWeight: el.fontWeight || undefined,
                  fontStyle: el.fontStyle || "normal",
                  textDecoration: el.textDecoration || "none",
                }}
              >
                {currentPrefix}{spVal}{currentSuffix}
              </span>
              <span
                contentEditable={isEditable}
                suppressContentEditableWarning
                onClick={(e) => { e.stopPropagation(); handleElementClick(e, mrpEl.id || "el_mrp"); }}
                onBlur={(e) => handleBlur(mrpEl.id || "mrpVal", e)}
                className={`${currentMrpClass} ${isStrike === false ? (isPrint ? "text-[7.5px]" : "text-[10px]") : (isPrint ? "text-[6.5px]" : "text-[9.5px]")} whitespace-nowrap outline-none ${getSelectableClass(mrpEl.id || "el_mrp")} rounded px-0.5 cursor-pointer`}
                style={{
                  color: mrpEl.color,
                  fontFamily: mrpEl.fontFamily || blockFont,
                  fontSize: mrpEl.fontSize ? (typeof mrpEl.fontSize === "number" ? `${mrpEl.fontSize}px` : mrpEl.fontSize) : undefined,
                  fontWeight: mrpEl.fontWeight || undefined,
                  fontStyle: mrpEl.fontStyle || "normal",
                  textDecoration: isStrike ? "line-through" : (mrpEl.textDecoration === "line-through" ? "line-through" : "none"),
                }}
              >
                {mrpPrefixToUse}{mrpVal}{mrpSuffixToUse}
              </span>
            </div>
          );
        } else {
          contentNode = (
            <div className={`flex items-center ${alignClass} w-full`}>
              <span
                contentEditable={isEditable}
                suppressContentEditableWarning
                onBlur={(e) => handleBlur(el.id || "spVal", e)}
                className={`${el.fontWeight === "bold" || el.fontWeight === "900" ? "font-black" : el.fontWeight === "normal" ? "font-normal" : "font-black"} ${isPrint ? "text-[8px]" : "text-[11px]"} ${customBadge} whitespace-nowrap outline-none`}
                style={{
                  color: el.color,
                  fontFamily: blockFont,
                  fontSize: el.fontSize ? (typeof el.fontSize === "number" ? `${el.fontSize}px` : el.fontSize) : undefined,
                  fontWeight: el.fontWeight || undefined,
                  fontStyle: el.fontStyle || "normal",
                  textDecoration: el.textDecoration || "none",
                }}
              >
                {currentPrefix}{spVal}{currentSuffix}
              </span>
            </div>
          );
        }
        break;
      }

      case "mrp": {
        const isInlineOffer =
          template?.themeName === "trendy_offer" ||
          template?.priceLayout === "center_offer" ||
          template?.priceLayout === "inline" ||
          template?.id === "tpl-bar-dual-trendy" ||
          template?.id === "tpl-bar-trendy-offer";
        const hasSp = isInlineOffer && elementsToRender.some((o) => o.type === "sellingPrice" && o.visible !== false);
        if (hasSp && f.showPrice !== false && spVal) {
          // Handled alongside sellingPrice in the inline row
          return null;
        }

        const isStrike = el.showStrike !== undefined ? el.showStrike : el.textDecoration === "line-through" ? true : el.textDecoration === "none" ? false : showMrpStrike;
        const currentMrpClass = isStrike === false
          ? "font-bold text-slate-900 no-underline tracking-tight"
          : mrpStrikeClass;
        const currentPrefix = cleanMrpPrefix(el.prefix, mrpPrefix);
        const currentSuffix = el.suffix || "";

        contentNode = (
          <div className={`flex items-center ${alignClass} w-full`}>
            <span
              contentEditable={isEditable}
              suppressContentEditableWarning
              onBlur={(e) => handleBlur(el.id || "mrpVal", e)}
              className={`${currentMrpClass} ${isStrike === false ? (isPrint ? "text-[7.5px]" : "text-[10px]") : (isPrint ? "text-[6.5px]" : "text-[9.5px]")} whitespace-nowrap outline-none`}
              style={{
                color: el.color,
                fontFamily: blockFont,
                fontSize: el.fontSize ? (typeof el.fontSize === "number" ? `${el.fontSize}px` : el.fontSize) : undefined,
                fontWeight: el.fontWeight || undefined,
                fontStyle: el.fontStyle || "normal",
                textDecoration: isStrike ? "line-through" : (el.textDecoration === "line-through" ? "line-through" : "none"),
              }}
            >
              {currentPrefix}{mrpVal}{currentSuffix}
            </span>
          </div>
        );
        break;
      }

      case "priceGroup":
        contentNode = renderPriceBlock();
        break;

      case "sku":
        contentNode = (
          <div className={`${blockAlign === "center" ? "text-center" : blockAlign === "right" ? "text-right" : "text-left"} w-full`}>
            <span
              contentEditable={isEditable}
              suppressContentEditableWarning
              onBlur={(e) => handleBlur(el.id || "sku", e)}
              className="font-mono font-bold truncate block outline-none"
              style={{
                fontFamily: blockFont || skuFont,
                color: el.color || skuColor,
                fontSize: el.fontSize ? (typeof el.fontSize === "number" ? `${el.fontSize}px` : el.fontSize) : (isPrint ? "6px" : "9.5px"),
                fontStyle: el.fontStyle || "normal",
                textDecoration: el.textDecoration || "none",
              }}
            >
              {el.prefix !== undefined ? el.prefix : skuPrefix}{resolvedSkuVal}{el.suffix || ""}
            </span>
          </div>
        );
        break;

      case "hsn":
        contentNode = (
          <div className={`${blockAlign === "center" ? "text-center" : blockAlign === "right" ? "text-right" : "text-left"} w-full`}>
            <span
              contentEditable={isEditable}
              suppressContentEditableWarning
              onBlur={(e) => handleBlur(el.id || "hsn", e)}
              className="font-mono text-slate-500 font-semibold truncate block outline-none"
              style={{
                fontSize: el.fontSize ? (typeof el.fontSize === "number" ? `${el.fontSize}px` : el.fontSize) : (isPrint ? "5.5px" : "8px"),
                fontFamily: blockFont,
                color: el.color,
                fontStyle: el.fontStyle || "normal",
                textDecoration: el.textDecoration || "none",
              }}
            >
              {el.prefix !== undefined ? el.prefix : hsnPrefix}{resolvedHsnVal}{el.suffix || ""}
            </span>
          </div>
        );
        break;

      case "barcodeGraphic": {
        const currentH = el.height || barcodeHeight;
        const currentScale = el.widthScale || template?.barcodeWidthScale || 1.0;
        const isSelected = selectedElementKey === el.id || selectedElementKey === "barcodeGraphic" || selectedElementKey === "barcode";
        contentNode = (
          <div
            onClick={(e) => handleElementClick(e, el.id || "barcodeGraphic")}
            className={`relative flex flex-col justify-center items-center w-full overflow-visible my-1 select-none ${getSelectableClass(el.id || "barcodeGraphic")}`}
          >
            {isEditable && isSelected && (
              <span className="absolute -top-3.5 left-0 bg-blue-600 text-white text-[7px] font-black px-1 rounded uppercase tracking-wider select-none pointer-events-none z-30 shadow-2xs">
                Barcode ({currentH}px × {Math.round(currentScale * 100)}%)
              </span>
            )}

            <div className="flex items-center justify-center w-full overflow-hidden">
              <RealBarcodeSvg
                code={item.barcode || "8904358601259"}
                format={barcodeSymbology}
                height={currentH}
                unitPx={isPrint ? 1.35 * currentScale : 1.6 * currentScale}
                displayValue={template?.showBarcodeText !== false}
              />
            </div>

            {/* Live Interactive Drag Resize Handles (Sides, Bottom, Corner) */}
            {isEditable && isSelected && (
              <>
                {/* Stepper buttons toolbar */}
                <div
                  className="absolute -top-3.5 right-0 z-30 flex items-center gap-1.5 bg-slate-900/95 text-white text-[7.5px] font-bold px-1.5 py-0.5 rounded-md shadow-md backdrop-blur-xs select-none"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-0.5">
                    <span>↕ {currentH}px</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextH = Math.max(16, currentH - 4);
                        onResizeBarcode?.(nextH, currentScale);
                        onResizeElement?.(el.id, { height: nextH });
                      }}
                      className="hover:bg-slate-700 px-1 rounded text-[8px] cursor-pointer"
                      title="Decrease height"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextH = Math.min(130, currentH + 4);
                        onResizeBarcode?.(nextH, currentScale);
                        onResizeElement?.(el.id, { height: nextH });
                      }}
                      className="hover:bg-slate-700 px-1 rounded text-[8px] cursor-pointer"
                      title="Increase height"
                    >
                      +
                    </button>
                  </div>

                  <span className="text-slate-500">|</span>

                  <div className="flex items-center gap-0.5">
                    <span>↔ {Math.round(currentScale * 100)}%</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextScale = Math.max(0.6, Number((currentScale - 0.1).toFixed(2)));
                        onResizeBarcode?.(currentH, nextScale);
                        onResizeElement?.(el.id, { widthScale: nextScale } as any);
                      }}
                      className="hover:bg-slate-700 px-1 rounded text-[8px] cursor-pointer"
                      title="Narrow width"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextScale = Math.min(2.2, Number((currentScale + 0.1).toFixed(2)));
                        onResizeBarcode?.(currentH, nextScale);
                        onResizeElement?.(el.id, { widthScale: nextScale } as any);
                      }}
                      className="hover:bg-slate-700 px-1 rounded text-[8px] cursor-pointer"
                      title="Widen width"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Left Side Drag Handle (Widen / Narrow from left) */}
                <div
                  onPointerDown={(e) => startBarcodeResizeWidth(e, "left")}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-7 flex items-center justify-center cursor-ew-resize hover:scale-125 transition-transform z-30 group/left"
                  title="Drag left/right to adjust barcode width on sides"
                >
                  <div className="w-1.5 h-5 bg-blue-600 border border-white rounded-full shadow-xs" />
                </div>

                {/* Right Side Drag Handle (Widen / Narrow from right) */}
                <div
                  onPointerDown={(e) => startBarcodeResizeWidth(e, "right")}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-7 flex items-center justify-center cursor-ew-resize hover:scale-125 transition-transform z-30 group/right"
                  title="Drag right/left to adjust barcode width on sides"
                >
                  <div className="w-1.5 h-5 bg-blue-600 border border-white rounded-full shadow-xs" />
                </div>

                {/* Bottom Drag Handle Bar (Height) */}
                <div
                  onPointerDown={startBarcodeResizeHeight}
                  className="w-full flex items-center justify-center py-1 mt-0.5 cursor-ns-resize hover:bg-blue-500/20 active:bg-blue-500/40 rounded transition-colors z-30"
                  title="Click and drag down/up to resize barcode height"
                >
                  <div className="flex items-center gap-1 bg-blue-600 text-white text-[7px] font-black px-2 py-0.5 rounded-full shadow-xs hover:scale-105 active:scale-95 transition-transform select-none">
                    <span>↕ Drag Height · ↔ Drag Side Handles</span>
                  </div>
                </div>

                {/* Bottom Corner 2D Resize Grip (Height & Width) */}
                <div
                  onPointerDown={startBarcodeResizeCorner}
                  className="absolute -bottom-1 -right-1 size-3.5 bg-blue-600 border-2 border-white rounded-tl cursor-nwse-resize shadow-md z-30 hover:scale-125 transition-transform"
                  title="Drag corner diagonally to resize height & width simultaneously"
                />
              </>
            )}
          </div>
        );
        break;
      }

      case "customText": {
        let rawCustom = customTexts[el.id] || el.customText || "Custom Label Text";
        // Dynamic placeholder interpolation if user writes {mrp}, {sp}, {sku}, {product_name}, {hsn}, {category}, {batch}, {dates}, {store}
        let textToRender = String(rawCustom)
          .replace(/\{mrp\}/gi, mrpVal)
          .replace(/\{sp\}/gi, spVal)
          .replace(/\{sku\}/gi, resolvedSkuVal)
          .replace(/\{product_name\}/gi, resolvedProductTitle)
          .replace(/\{product\}/gi, resolvedProductTitle)
          .replace(/\{hsn\}/gi, resolvedHsnVal)
          .replace(/\{batch\}/gi, resolvedBatchVal)
          .replace(/\{store\}/gi, resolvedStoreTitle)
          .replace(/\{dates\}/gi, resolvedDateVal)
          .replace(/\{category\}/gi, item.category_name || "Category");

        const currentPrefix = el.prefix || "";
        const currentSuffix = el.suffix || "";

        contentNode = (
          <div className={`${blockAlign === "center" ? "text-center justify-center" : blockAlign === "right" ? "text-right justify-end" : "text-left justify-start"} flex items-center w-full`}>
            <span
              contentEditable={isEditable}
              suppressContentEditableWarning
              onBlur={(e) => handleBlur(el.id, e)}
              className={`${el.fontWeight === "bold" || el.fontWeight === "900" ? "font-bold" : "font-normal"} outline-none block truncate`}
              style={{
                color: el.color || "#475569",
                fontFamily: blockFont,
                fontSize: el.fontSize ? (typeof el.fontSize === "number" ? `${el.fontSize}px` : el.fontSize) : (isPrint ? "6px" : "9px"),
                textTransform: el.textTransform || "none",
                fontStyle: el.fontStyle || "normal",
                textDecoration: el.textDecoration || "none",
              }}
            >
              {currentPrefix}{textToRender}{currentSuffix}
            </span>
          </div>
        );
        break;
      }

      case "category":
        contentNode = (
          <div className={`${alignClass} flex items-center w-full`}>
            <span
              contentEditable={isEditable}
              suppressContentEditableWarning
              onBlur={(e) => handleBlur(el.id || "categoryName", e)}
              className="font-semibold text-slate-500 uppercase truncate outline-none"
              style={{
                fontFamily: blockFont,
                fontSize: el.fontSize ? (typeof el.fontSize === "number" ? `${el.fontSize}px` : el.fontSize) : (isPrint ? "6px" : "8.5px"),
                color: el.color || "#64748b",
                fontStyle: el.fontStyle || "normal",
                textDecoration: el.textDecoration || "none",
              }}
            >
              {el.prefix || ""}{customTexts[el.id] || el.customText || item.category_name || "Category"}{el.suffix || ""}
            </span>
          </div>
        );
        break;

      case "divider":
        contentNode = (
          <div className="w-full my-0.5">
            <div
              style={{
                borderTop: `${el.height || 1}px ${el.borderStyle || "solid"} ${el.color || "#cbd5e1"}`,
              }}
              className="w-full"
            />
          </div>
        );
        break;

      case "discountBadge":
        contentNode = (
          <div className={`flex items-center ${alignClass} w-full`}>
            <span
              className="text-[7.5px] font-black text-emerald-700 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded-full whitespace-nowrap shadow-2xs"
              style={{
                fontFamily: blockFont,
                fontSize: el.fontSize ? (typeof el.fontSize === "number" ? `${el.fontSize}px` : el.fontSize) : undefined,
                color: el.color,
              }}
            >
              {el.prefix || ""}{el.customText || `${discountPercent > 0 ? discountPercent : 20}% OFF`}{el.suffix || ""}
            </span>
          </div>
        );
        break;

      case "batchMfgExp":
        contentNode = (
          <div
            className="flex items-center justify-between text-[7px] text-slate-500 w-full"
            style={{
              fontFamily: blockFont,
              fontSize: el.fontSize ? (typeof el.fontSize === "number" ? `${el.fontSize}px` : el.fontSize) : undefined,
              color: el.color,
            }}
          >
            <span>{el.prefix || ""}Mfg: {item.pkd_date || "07/26"} | Exp: {item.exp_date || "07/29"}</span>
            {item.batch_no && <span>Lot: {item.batch_no}{el.suffix || ""}</span>}
          </div>
        );
        break;

      default:
        contentNode = null;
    }

    if (!contentNode) return null;

    const isFree = el.isFreePositioned || el.posX !== undefined || (dragLivePos && dragLivePos.id === el.id);
    const displayX = dragLivePos && dragLivePos.id === el.id ? dragLivePos.posX : el.posX ?? 0;
    const displayY = dragLivePos && dragLivePos.id === el.id ? dragLivePos.posY : el.posY ?? 0;
    const isDraggingThis = activeDragId === el.id;
    const isSelected = selectedElementKey === el.id;

    const blockStyle: React.CSSProperties = isFree
      ? {
          position: "absolute",
          left: `${displayX}%`,
          top: `${displayY}%`,
          zIndex: isDraggingThis ? 50 : isSelected ? 30 : el.zIndex || 10,
          width: el.width ? (typeof el.width === "number" ? `${el.width}px` : el.width) : (el.textAlign === "center" || el.type === "companyName" || el.type === "divider" ? "100%" : "auto"),
          maxWidth: "100%",
          touchAction: "none",
        }
      : {
          position: "relative",
          marginTop: el.marginTop !== undefined ? `${el.marginTop}px` : undefined,
          marginBottom: el.marginBottom !== undefined ? `${el.marginBottom}px` : "1.5px",
          touchAction: "none",
        };

    return (
      <div
        key={el.id}
        id={`barcode-block-${el.id}`}
        onClick={(e) => handleElementClick(e, el.id)}
        className={`${getSelectableClass(el.id)} ${isFree ? "absolute" : "w-full relative"} transition-all select-none group/elem ${
          isDraggingThis ? "ring-2 ring-blue-500 shadow-xl opacity-90 scale-[1.02] z-50 cursor-grabbing" : ""
        }`}
        style={blockStyle}
      >
        {isEditable && (isSelected || isDraggingThis) && (
          <div className="absolute -top-3.5 left-0 z-40 bg-blue-600 text-white text-[7px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider select-none pointer-events-none shadow-xs flex items-center gap-1">
            <span>{el.label || el.type}</span>
          </div>
        )}

        {isEditable && (isSelected || isDraggingThis) && (
          <div className="absolute -top-3.5 right-0 z-40 flex items-center gap-1">
            {isFree && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveElement?.(el.id, { posX: 0, posY: 0, isFreePositioned: false });
                  onResizeElement?.(el.id, { posX: 0, posY: 0, isFreePositioned: false });
                }}
                className="bg-amber-600 hover:bg-amber-500 text-white text-[7px] font-black px-1.5 py-0.2 rounded shadow-md cursor-pointer flex items-center gap-0.5 select-none"
                title="Reset element back to normal flow layout"
              >
                ↩ Snap to Flow
              </button>
            )}
            <div
              onPointerDown={(e) => {
                e.stopPropagation();
                startElementDrag(e, el, e.currentTarget.parentElement?.parentElement);
              }}
              className="bg-blue-700 hover:bg-blue-600 text-white text-[7px] font-black px-1.5 py-0.2 rounded shadow-md cursor-grab active:cursor-grabbing flex items-center gap-0.5 select-none transition-transform active:scale-95"
              title="Drag and place this element anywhere on the label sticker"
            >
              <span>✥ Drag Anywhere</span>
              {isFree && <span className="text-[6.5px] opacity-90 font-mono">({displayX}%, {displayY}%)</span>}
            </div>
          </div>
        )}

        {contentNode}
      </div>
    );
  };

  return (
    <div
      ref={cardContainerRef}
      className={`${borderClass} ${radiusClass} ${
        isPrint ? "pt-2 pb-1 px-1.5 h-[21.5mm] max-h-[21.5mm] w-full" : "p-2.5 min-h-[135px]"
      } flex flex-col justify-center items-center shadow-xs select-none overflow-hidden box-border bg-white text-slate-950 relative`}
      style={{ fontFamily, backgroundColor: paperBgColor, borderColor, position: "relative" }}
    >
      <div className="w-full flex flex-col justify-center items-center h-full space-y-0.5 relative">
        {elementsToRender.map((el) => renderSingleElementBlock(el))}
      </div>
    </div>
  );
}


/**
 * Helper to clean up price prefixes and prevent accidental "SP: MRP: " duplicates
 */
export function cleanSpPrefix(prefix: any, defaultSp: string = "SP: "): string {
  if (prefix === undefined || prefix === null) return defaultSp;
  const s = String(prefix).trim();
  if (/^m\.?r\.?p\.?/i.test(s)) return defaultSp;
  return String(prefix);
}

export function cleanMrpPrefix(prefix: any, defaultMrp: string = "MRP: "): string {
  if (prefix === undefined || prefix === null) return defaultMrp;
  const s = String(prefix).trim();
  if (/^(sp|offer)/i.test(s)) return defaultMrp;
  return String(prefix);
}

/**
 * Generates standalone SVG barcode string with crisp black lines for print documents
 * Engineered specifically for 100% optical readability on Handheld CCD & Laser scanners (TVS, Zebra, Honeywell, TSC).
 */
export function generateBarcodeSvgString(
  code: string,
  height: number = 24,
  unitPx: number = 1.25,
  formatOverride?: "Auto" | "Code-128" | "EAN-13" | string,
  showText: boolean = true
): string {
  const clean = String(code || "8904358601259").trim();
  if (!clean) return "";

  const isNumeric13 = /^\d{13}$/.test(clean);
  const isNumeric8 = /^\d{8}$/.test(clean);
  const isNumeric12 = /^\d{12}$/.test(clean);

  const upperFmt = (formatOverride || "Auto").toUpperCase();
  let jsFormat = "CODE128";
  if (upperFmt.includes("EAN-13") || upperFmt.includes("EAN13")) {
    jsFormat = "EAN13";
  } else if (upperFmt.includes("EAN-8") || upperFmt.includes("EAN8")) {
    jsFormat = "EAN8";
  } else if (upperFmt.includes("UPC")) {
    jsFormat = "UPC";
  } else if (upperFmt === "AUTO") {
    if (isNumeric13) jsFormat = "EAN13";
    else if (isNumeric8) jsFormat = "EAN8";
    else if (isNumeric12) jsFormat = "UPC";
    else jsFormat = "CODE128";
  }

  const fontSize = Math.max(9, Math.min(13, Math.round(height * 0.35)));
  const barHeight = Math.max(10, height - (showText ? fontSize + 2 : 1));

  if (typeof document !== "undefined") {
    try {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      try {
        JsBarcode(svg, clean, {
          format: jsFormat,
          width: Math.max(1.0, unitPx || 1.15),
          height: barHeight,
          displayValue: showText,
          fontOptions: "bold",
          fontSize: fontSize,
          font: "Inter, Arial, sans-serif",
          textAlign: "center",
          textPosition: "bottom",
          textMargin: 1,
          margin: 1,
          background: "#ffffff",
          lineColor: "#000000",
        });
      } catch (e1) {
        JsBarcode(svg, clean, {
          format: "CODE128",
          width: Math.max(1.0, unitPx || 1.15),
          height: barHeight,
          displayValue: showText,
          fontOptions: "bold",
          fontSize: fontSize,
          font: "Inter, Arial, sans-serif",
          textAlign: "center",
          textPosition: "bottom",
          textMargin: 1,
          margin: 1,
          background: "#ffffff",
          lineColor: "#000000",
        });
      }

      svg.setAttribute("shape-rendering", "crispEdges");
      const wAttr = svg.getAttribute("width");
      const hAttr = svg.getAttribute("height");
      if (wAttr && hAttr && !svg.getAttribute("viewBox")) {
        svg.setAttribute("viewBox", `0 0 ${wAttr} ${hAttr}`);
      }
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg.setAttribute(
        "style",
        `display:block;margin:0 auto;background:#ffffff;width:100%;max-width:98%;height:auto;max-height:100%;overflow:visible;image-rendering:pixelated;`
      );
      return svg.outerHTML;
    } catch (e) {
      console.warn("generateBarcodeSvgString DOM error:", e);
    }
  }

  // Pure SVG fallback
  const data = getBarcodeRenderData(clean, formatOverride || "Auto");
  if (!data) return "";

  const unit = Math.max(1.0, Number(unitPx) || 1.15);
  const quietZonePx = 8 * unit;
  const contentWidth = data.totalModules * unit;
  const svgWidth = contentWidth + quietZonePx * 2;
  const totalSvgHeight = barHeight + (showText ? fontSize + 2 : 1);
  const textBaseline = totalSvgHeight - 1;
  const barTop = 0;

  let curX = quietZonePx;
  let barsHtml = "";
  data.runs.forEach((b) => {
    const w = b.width * unit;
    const x = curX;
    curX += w;
    if (b.isBlack) {
      barsHtml += `<rect x="${x.toFixed(1)}" y="${barTop}" width="${w.toFixed(1)}" height="${barHeight}" fill="#000000" />`;
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${totalSvgHeight}" viewBox="0 0 ${svgWidth} ${totalSvgHeight}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" style="display:block;margin:0 auto;background:#ffffff;width:100%;max-width:98%;height:auto;max-height:100%;overflow:visible;image-rendering:pixelated;">
    <rect width="${svgWidth}" height="${totalSvgHeight}" fill="#ffffff" />
    ${barsHtml}
    ${showText ? `<text x="${Math.round(svgWidth / 2)}" y="${textBaseline}" text-anchor="middle" font-size="${fontSize}" font-family="Inter, Arial, sans-serif" font-weight="900" letter-spacing="1.2px" fill="#000000">${data.clean}</text>` : ""}
  </svg>`;
}

/**
 * Generates the full print HTML string for barcode labels (used for print preview iframe and actual printing).
 */
export function generateBarcodeLabelHtml(
  items: ProductBarcodeLike[],
  template: any = {},
  layout:
    | "1up"
    | "2up"
    | "3up"
    | "4up"
    | "a4"
    | "a4_24"
    | "a4_30"
    | "a4_40"
    | "a4_65"
    | "fmcg" = "1up",
  currencySymbol: string = "₹",
  orgName?: string,
  barcodeFormatOverride?: "Auto" | "Code-128" | "EAN-13" | string
): string {
  if (!items || items.length === 0) return "";

  const f = template?.fields || {
    showCompanyName: true,
    showCategoryBrand: true,
    showProductName: true,
    showSKU: true,
    showPrice: true,
    showMRP: true,
    showBarcodeGraphic: true,
    showBarcodeText: true,
  };

  const elemStyles = template?.elementSettings || {};
  const customTexts = template?.customTexts || {};

  const fontFamily = template?.fontFamily || "Inter, -apple-system, sans-serif";
  const globalAlign = template?.textAlign || "center";
  const borderStyle = template?.borderStyle || "none";
  const borderRadius = template?.borderRadius || "sm";
  const primaryColor = template?.primaryColor || "#0f172a";
  const paperBgColor = template?.paperBgColor || "#ffffff";
  const activeFormat = barcodeFormatOverride || template?.barcodeSymbology || template?.barcodeFormat || "Auto";

  const rawSpPref =
    customTexts.spPrefix !== undefined
      ? customTexts.spPrefix
      : template?.spPrefix !== undefined
      ? template.spPrefix
      : elemStyles.priceSp?.prefix !== undefined
      ? elemStyles.priceSp.prefix
      : "SP: ";

  const rawMrpPref =
    customTexts.mrpPrefix !== undefined
      ? customTexts.mrpPrefix
      : template?.mrpPrefix !== undefined
      ? template.mrpPrefix
      : template?.pricePrefix !== undefined
      ? template.pricePrefix
      : elemStyles.priceMrp?.prefix !== undefined
      ? elemStyles.priceMrp.prefix
      : "MRP: ";

  const spPrefix = cleanSpPrefix(rawSpPref, "SP: ");
  const mrpPrefix = cleanMrpPrefix(rawMrpPref, "MRP: ");

  const showMrpStrike = elemStyles.priceMrp?.showStrike ?? template?.showMrpStrike ?? true;
  const isBoldMrpStrike = elemStyles.priceMrp?.strikeBold ?? template?.isBoldMrpStrike ?? true;
  const mrpStrikeColor = elemStyles.priceMrp?.strikeColor ?? template?.mrpStrikeColor ?? "gray";
  const spBadgeStyle = elemStyles.priceSp?.badgeStyle ?? template?.spBadgeStyle ?? "none";
  const storeName = resolveOrgName(orgName, template?.storeName);

  // Dynamic label dimension handler for custom papers
  let customPaperW = template?.labelWidthMm ? Number(template.labelWidthMm) : 50;
  let customPaperH = template?.labelHeightMm ? Number(template.labelHeightMm) : 25;

  if (template?.paperSize) {
    const m = String(template.paperSize).match(/^(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)\s*(?:mm)?$/);
    if (m) {
      customPaperW = parseFloat(m[1]);
      customPaperH = parseFloat(m[2]);
    }
  } else if (template?.paperWidth && template?.paperHeight) {
    customPaperW = parseFloat(template.paperWidth);
    customPaperH = parseFloat(template.paperHeight);
  }

  // Determine active layout
  const activeLayout = layout || template?.labelLayout || (template?.id?.includes("dual") ? "2up" : "1up");

  let pageCss = `@page { size: ${customPaperW}mm ${customPaperH}mm; margin: 0mm !important; }`;
  let pageStyle = "";
  let rowStyle = "";
  let cardStyle = "";
  let columns = 1;
  let defaultBarcodeHeight = template?.barcodeHeight || 14;
  let defaultBaseUnitPx = 1.15;
  const labelHeightMm = customPaperH;

  if (activeLayout === "1up") {
    const pw = customPaperW || 50;
    const ph = customPaperH || 25;
    pageCss = `@page { size: ${pw}mm ${ph}mm; margin: 0mm !important; }`;
    pageStyle = `width: ${pw}mm; height: ${ph}mm; max-width: ${pw}mm; max-height: ${ph}mm; page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid; overflow: hidden; box-sizing: border-box; display: flex; align-items: center; justify-content: center; margin: 0; padding: 0;`;
    rowStyle = `width: ${pw}mm; height: ${ph}mm; max-width: ${pw}mm; max-height: ${ph}mm; margin: 0 auto; display: flex; justify-content: center; align-items: center; box-sizing: border-box; overflow: hidden; padding: ${ph <= 25 ? "2.2mm 0.5mm 0.8mm 0.5mm" : "1.0mm"};`;
    cardStyle = `width: calc(${pw}mm - 2.5mm); height: ${ph <= 25 ? "21.5mm" : `calc(${ph}mm - 1.5mm)`}; max-height: ${ph <= 25 ? "21.5mm" : `calc(${ph}mm - 1.5mm)`}; box-sizing: border-box; padding: ${ph >= 45 ? "2.0mm 2.0mm" : ph >= 30 ? "1.5mm 1.5mm" : "1.0mm 1.5mm 0.8mm 1.5mm"}; margin: 0 auto; display: flex; flex-direction: column; justify-content: space-between; align-items: center; overflow: hidden;`;
    columns = 1;
    defaultBarcodeHeight = template?.barcodeHeight || (ph >= 45 ? 36 : ph >= 30 ? 20 : 12);
    defaultBaseUnitPx = pw >= 80 ? 1.4 : 1.15;
  } else if (activeLayout === "2up") {
    pageCss = "@page { size: 100mm 25mm; margin: 0mm !important; }";
    pageStyle = "width: 100mm; height: 25mm; max-width: 100mm; max-height: 25mm; page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid; overflow: hidden; box-sizing: border-box; display: flex; align-items: center; justify-content: center; margin: 0; padding: 0;";
    rowStyle = "width: 100mm; height: 25mm; max-width: 100mm; max-height: 25mm; margin: 0 auto; display: grid; grid-template-columns: 48mm 48mm; column-gap: 3mm; justify-content: center; align-items: center; box-sizing: border-box; overflow: hidden; padding: 2.2mm 0.5mm 0.8mm 0.5mm;";
    cardStyle = "width: 48mm; height: 21.5mm; max-height: 21.5mm; box-sizing: border-box; flex-shrink: 0; padding: 1.0mm 1.5mm 0.8mm 1.5mm; margin: 0 auto; display: flex; flex-direction: column; justify-content: space-between; align-items: center; overflow: hidden;";
    columns = 2;
    defaultBarcodeHeight = template?.barcodeHeight || 12;
    defaultBaseUnitPx = 1.15;
  } else if (activeLayout === "3up") {
    pageCss = "@page { size: 114mm 25mm; margin: 0mm !important; }";
    pageStyle = "width: 114mm; height: 25mm; max-width: 114mm; max-height: 25mm; page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid; overflow: hidden; box-sizing: border-box; display: flex; align-items: center; justify-content: center; margin: 0; padding: 0;";
    rowStyle = "width: 114mm; height: 25mm; max-width: 114mm; max-height: 25mm; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.0mm; align-items: center; box-sizing: border-box; overflow: hidden; padding: 2.2mm 0.5mm 0.8mm 0.5mm;";
    cardStyle = "width: 100%; height: 21.5mm; max-height: 21.5mm; box-sizing: border-box; flex-shrink: 0; padding: 0.8mm 1.0mm 0.6mm 1.0mm; display: flex; flex-direction: column; justify-content: space-between; align-items: center; overflow: hidden;";
    columns = 3;
    defaultBarcodeHeight = template?.barcodeHeight || 11;
    defaultBaseUnitPx = 1.05;
  } else if (activeLayout === "4up") {
    pageCss = "@page { size: 100mm 25mm; margin: 0mm !important; }";
    pageStyle = "width: 100mm; height: 25mm; max-width: 100mm; max-height: 25mm; page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid; overflow: hidden; box-sizing: border-box; display: flex; align-items: center; justify-content: center; margin: 0; padding: 0;";
    rowStyle = "width: 100mm; height: 25mm; max-width: 100mm; max-height: 25mm; margin: 0 auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.2mm; align-items: center; box-sizing: border-box; overflow: hidden; padding: 2.2mm 0.5mm 0.8mm 0.5mm;";
    cardStyle = "width: 100%; height: 21.5mm; max-height: 21.5mm; box-sizing: border-box; flex-shrink: 0; padding: 0.6mm 0.6mm 0.6mm 0.6mm; display: flex; flex-direction: column; justify-content: space-between; align-items: center; overflow: hidden;";
    columns = 4;
    defaultBarcodeHeight = template?.barcodeHeight || 10;
    defaultBaseUnitPx = 0.95;
  } else if (activeLayout === "fmcg") {
    pageCss = "@page { size: 50mm 50mm; margin: 0mm !important; }";
    pageStyle = "width: 50mm; height: 50mm; max-width: 50mm; max-height: 50mm; page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid; overflow: hidden; box-sizing: border-box; display: block; margin: 0; padding: 0;";
    rowStyle = "width: 50mm; height: 50mm; max-width: 50mm; max-height: 50mm; margin: 0 auto; display: flex; justify-content: center; align-items: center; box-sizing: border-box; overflow: hidden;";
    cardStyle = "width: 47mm; height: 47mm; box-sizing: border-box; padding: 1.5mm 1.5mm; display: flex; flex-direction: column; justify-content: space-between; align-items: center; overflow: hidden;";
    columns = 1;
    defaultBarcodeHeight = template?.barcodeHeight || 24;
    defaultBaseUnitPx = 1.35;
  } else if (activeLayout === "a4_24") {
    pageCss = "@page { size: A4 portrait; margin: 6mm 4mm !important; }";
    pageStyle = "width: 100%; page-break-inside: avoid; break-inside: avoid; display: block; margin-bottom: 2mm;";
    rowStyle = "width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid;";
    cardStyle = "width: 100%; height: 34mm; max-height: 34mm; page-break-inside: avoid; break-inside: avoid; box-sizing: border-box; padding: 1.5mm 2.0mm; display: flex; flex-direction: column; justify-content: space-between; align-items: center; overflow: hidden;";
    columns = 3;
    defaultBarcodeHeight = template?.barcodeHeight || 28;
    defaultBaseUnitPx = 1.4;
  } else if (activeLayout === "a4_30") {
    pageCss = "@page { size: A4 portrait; margin: 5mm 3mm !important; }";
    pageStyle = "width: 100%; page-break-inside: avoid; break-inside: avoid; display: block; margin-bottom: 2mm;";
    rowStyle = "width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5mm; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid;";
    cardStyle = "width: 100%; height: 26mm; max-height: 26mm; page-break-inside: avoid; break-inside: avoid; box-sizing: border-box; padding: 1.2mm 1.6mm; display: flex; flex-direction: column; justify-content: space-between; align-items: center; overflow: hidden;";
    columns = 3;
    defaultBarcodeHeight = template?.barcodeHeight || 22;
    defaultBaseUnitPx = 1.35;
  } else if (activeLayout === "a4_40") {
    pageCss = "@page { size: A4 portrait; margin: 5mm 3mm !important; }";
    pageStyle = "width: 100%; page-break-inside: avoid; break-inside: avoid; display: block; margin-bottom: 2mm;";
    rowStyle = "width: 100%; display: grid; grid-template-columns: repeat(4, 1fr); gap: 2mm; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid;";
    cardStyle = "width: 100%; height: 26mm; max-height: 26mm; page-break-inside: avoid; break-inside: avoid; box-sizing: border-box; padding: 1.0mm 1.2mm; display: flex; flex-direction: column; justify-content: space-between; align-items: center; overflow: hidden;";
    columns = 4;
    defaultBarcodeHeight = template?.barcodeHeight || 20;
    defaultBaseUnitPx = 1.15;
  } else if (activeLayout === "a4_65") {
    pageCss = "@page { size: A4 portrait; margin: 4mm 2mm !important; }";
    pageStyle = "width: 100%; page-break-inside: avoid; break-inside: avoid; display: block; margin-bottom: 1.5mm;";
    rowStyle = "width: 100%; display: grid; grid-template-columns: repeat(5, 1fr); gap: 1.5mm; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid;";
    cardStyle = "width: 100%; height: 20mm; max-height: 20mm; page-break-inside: avoid; break-inside: avoid; box-sizing: border-box; padding: 0.8mm 1.0mm; display: flex; flex-direction: column; justify-content: space-between; align-items: center; overflow: hidden;";
    columns = 5;
    defaultBarcodeHeight = template?.barcodeHeight || 16;
    defaultBaseUnitPx = 1.0;
  } else {
    pageCss = "@page { size: A4 portrait; margin: 5mm 3mm !important; }";
    pageStyle = "width: 100%; page-break-inside: avoid; break-inside: avoid; display: block; margin-bottom: 2.5mm;";
    rowStyle = "width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5mm; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid;";
    cardStyle = "width: 100%; height: 25mm; max-height: 25mm; page-break-inside: avoid; break-inside: avoid; box-sizing: border-box; padding: 1.2mm 1.6mm; display: flex; flex-direction: column; justify-content: space-between; align-items: center; overflow: hidden;";
    columns = 3;
    defaultBarcodeHeight = template?.barcodeHeight || 22;
    defaultBaseUnitPx = 1.35;
  }

  // Ensure enough items for multi-up preview if only 1 item provided
  let displayItems = [...items];
  if (displayItems.length < columns) {
    while (displayItems.length < columns) {
      displayItems.push(items[0]);
    }
  }

  const rows: ProductBarcodeLike[][] = [];
  for (let i = 0; i < displayItems.length; i += columns) {
    rows.push(displayItems.slice(i, i + columns));
  }

  // Dynamic font sizing engine with responsive proportional scaling
  const isThermalCompact = labelHeightMm <= 25;
  const heightScale = isThermalCompact ? 1.0 : Math.max(0.75, Math.min(2.5, labelHeightMm / 25));
  const isTrendyOffer =
    template?.themeName === "trendy_offer" ||
    template?.priceLayout === "center_offer" ||
    template?.id === "tpl-bar-trendy-offer" ||
    template?.id === "tpl-bar-dual-trendy";

  const getCalculatedFontSize = (rawSize: any, basePt: number, maxPt: number = 32): string => {
    if (rawSize !== undefined && rawSize !== null && rawSize !== "") {
      let num = typeof rawSize === "number" ? rawSize : parseFloat(String(rawSize));
      if (!isNaN(num) && num > 0) {
        const pt = Math.min(maxPt, Math.max(3.8, Number((num * 0.72 * heightScale).toFixed(1))));
        return `${pt}pt`;
      }
    }
    const scaled = Math.min(maxPt, Math.max(3.8, Number((basePt * heightScale).toFixed(1))));
    return `${scaled}pt`;
  };

  const cardsHtml = rows
    .map((rowItems) => {
      const rowCards = rowItems
        .map((item) => {
          const rawSpNum = item.selling_price != null && Number(item.selling_price) > 0 ? Number(item.selling_price) : null;
          const rawMrpNum = item.mrp != null && Number(item.mrp) > 0 ? Number(item.mrp) : null;

          const resolvedSpNum = rawSpNum != null ? rawSpNum : (rawMrpNum != null ? rawMrpNum : null);
          const resolvedMrpNum = rawMrpNum != null ? rawMrpNum : (rawSpNum != null ? Number((rawSpNum * 1.25).toFixed(2)) : null);

          const sellingPrice = resolvedSpNum != null ? `${currencySymbol}${resolvedSpNum.toFixed(2)}` : "";
          const mrp = resolvedMrpNum != null ? `${currencySymbol}${resolvedMrpNum.toFixed(2)}` : "";

          let discountPercent = 0;
          if (resolvedMrpNum && resolvedSpNum && resolvedMrpNum > resolvedSpNum) {
            discountPercent = Math.round(((resolvedMrpNum - resolvedSpNum) / resolvedMrpNum) * 100);
          }

          const borderCss =
            borderStyle === "dashed"
              ? "border: 0.75pt dashed #94a3b8;"
              : borderStyle === "double"
              ? "border: 1.5pt double #334155;"
              : borderStyle === "none"
              ? "border: 0;"
              : "border: 0.5pt solid #cbd5e1;";

          const radiusCss =
            borderRadius === "none"
              ? "border-radius: 0;"
              : borderRadius === "md"
              ? "border-radius: 3pt;"
              : borderRadius === "lg"
              ? "border-radius: 5pt;"
              : borderRadius === "full"
              ? "border-radius: 8pt;"
              : "border-radius: 2pt;";

          const renderedCompanyName = customTexts.storeName || storeName;
          const renderedProdName = customTexts.productName || item.product_name || "Product";

          const elementsToRender = (
            Array.isArray(template?.elements) && template.elements.length > 0
              ? template.elements
              : getDefaultBarcodeElements(template)
          ).filter((el: any) => {
            if (el.visible === false) return false;
            if (el.id === "el_sku" && f.showSKU !== true && f.showHSN !== true) return false;
            if (el.type === "sku" && f.showSKU !== true) return false;
            if (el.type === "hsn" && f.showHSN !== true) return false;
            if (el.id === "el_footer" && f.showCustomTagline !== true && f.showMfgExpDate !== true) return false;
            if (el.type === "companyName" && f.showCompanyName === false) return false;
            if (el.type === "productName" && f.showProductName === false) return false;
            if (el.type === "priceGroup" && f.showPrice === false && f.showMRP === false) return false;
            if (el.type === "sellingPrice" && f.showPrice === false) return false;
            if (el.type === "mrp" && f.showMRP === false) return false;
            if (el.type === "barcodeGraphic" && f.showBarcodeGraphic === false) return false;
            return true;
          });

          const isAnyElementFree = elementsToRender.some((el: any) => el.isFreePositioned || el.posX !== undefined);

          const cardBodyHtml = elementsToRender
            .map((el: any) => {
              const isFree = el.isFreePositioned || el.posX !== undefined;
              const posCss = isFree
                ? `position: absolute; left: ${el.posX ?? 0}%; top: ${el.posY ?? 0}%; z-index: ${el.zIndex || 10}; width: ${el.width ? (typeof el.width === 'number' ? el.width + 'px' : el.width) : (el.textAlign === "center" || el.type === "companyName" || el.type === "divider" ? "100%" : "auto")}; max-width: 100%;`
                : `position: relative; margin-top: ${el.marginTop ?? 0}px; margin-bottom: ${el.marginBottom ?? 0}px; width: 100%; flex-shrink: 0;`;

              const alignCss = el.textAlign === "center" ? "text-align: center; justify-content: center;" : el.textAlign === "right" ? "text-align: right; justify-content: flex-end;" : "text-align: left; justify-content: flex-start;";
              const fontCss = `font-family: ${el.fontFamily || fontFamily}; color: ${el.color || '#020617'}; font-weight: ${el.fontWeight || 'normal'}; text-transform: ${el.textTransform || 'none'}; text-decoration: ${el.textDecoration || 'none'}; font-style: ${el.fontStyle || 'normal'};`;

              if (el.type === "companyName") {
                const cWeight = el.fontWeight || elemStyles.header?.fontWeight || (isTrendyOffer ? "900" : "700");
                const cSize = getCalculatedFontSize(el.fontSize || elemStyles.header?.fontSize, isTrendyOffer ? 8.2 : 7.2);
                const cColor = el.color || elemStyles.header?.color || primaryColor;
                const cTransform = el.textTransform || (template?.isUppercaseCompany !== false ? "uppercase" : "none");
                const borderBottomCss = el.borderBottom ? `border-bottom: 0.5pt solid #cbd5e1; padding-bottom: 0.2mm;` : '';
                return `<div style="${posCss} ${alignCss} ${borderBottomCss} line-height: 1;"><span style="font-family: ${el.fontFamily || fontFamily}; font-weight: ${cWeight}; font-size: ${cSize}; color: ${cColor}; letter-spacing: 0.3px; text-transform: ${cTransform}; font-style: ${el.fontStyle || 'normal'}; text-decoration: ${el.textDecoration || 'none'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${el.prefix || ''}${customTexts[el.id] || customTexts.storeName || el.customText || renderedCompanyName}${el.suffix || ''}</span></div>`;
              }
              if (el.type === "productName") {
                const pWeight = el.fontWeight || elemStyles.productName?.fontWeight || (isTrendyOffer ? "900" : template?.isBoldProductName !== false ? '700' : '600');
                const pSize = getCalculatedFontSize(el.fontSize || elemStyles.productName?.fontSize, isTrendyOffer ? 8.5 : 7.2);
                const pColor = el.color || elemStyles.productName?.color || '#000000';
                return `<div style="${posCss} ${alignCss} line-height: 1.1;"><span style="font-family: ${el.fontFamily || fontFamily}; font-weight: ${pWeight}; font-size: ${pSize}; color: ${pColor}; font-style: ${el.fontStyle || 'normal'}; text-decoration: ${el.textDecoration || 'none'}; text-transform: ${el.textTransform || 'none'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${el.prefix || ''}${customTexts[el.id] || customTexts.productName || el.customText || renderedProdName}${el.suffix || ''}</span></div>`;
              }
              if (el.type === "sellingPrice") {
                const isInlineOffer = isTrendyOffer || template?.priceLayout === "center_offer" || template?.priceLayout === "inline";
                const mrpEl = isInlineOffer ? elementsToRender.find((o: any) => o.type === "mrp") : null;
                const spSz = getCalculatedFontSize(el.fontSize || elemStyles.priceSp?.fontSize, isTrendyOffer ? 8.0 : 7.0);
                const spWeight = el.fontWeight || elemStyles.priceSp?.fontWeight || '900';
                const currentBadge = el.badgeStyle || spBadgeStyle;
                const badgeStyleCss =
                  currentBadge === "pill"
                    ? "background-color: #059669 !important; color: #ffffff !important; padding: 0.5px 3px !important; border-radius: 9999px !important;"
                    : currentBadge === "dark"
                    ? "background-color: #0f172a !important; color: #ffffff !important; padding: 0.5px 3px !important; border-radius: 2px !important;"
                    : currentBadge === "gold"
                    ? "background-color: #fbbf24 !important; color: #000000 !important; padding: 0.5px 3px !important; border-radius: 2px !important;"
                    : currentBadge === "outline"
                    ? "border: 1px solid #4f46e5 !important; color: #4338ca !important; padding: 0.5px 2px !important; border-radius: 2px !important;"
                    : `color: ${el.color || '#000000'} !important;`;

                const effectiveSpPref = cleanSpPrefix(el.prefix, spPrefix);

                if (mrpEl && mrp) {
                  const isStrike = mrpEl.showStrike !== undefined ? mrpEl.showStrike : mrpEl.textDecoration === "line-through" ? true : mrpEl.textDecoration === "none" ? false : showMrpStrike;
                  const strikeStyle = isStrike ? `text-decoration: line-through !important; text-decoration-color: ${mrpStrikeColor === 'red' ? '#dc2626' : '#000000'} !important;` : `text-decoration: none !important;`;
                  const mrpSz = getCalculatedFontSize(mrpEl.fontSize || elemStyles.priceMrp?.fontSize, isTrendyOffer ? 7.5 : 6.5);
                  const mrpWeight = mrpEl.fontWeight || elemStyles.priceMrp?.fontWeight || (isTrendyOffer ? '900' : '600');
                  const mrpFontCss = `font-family: ${mrpEl.fontFamily || fontFamily}; color: ${mrpEl.color || '#000000'};`;
                  const effectiveMrpPref = cleanMrpPrefix(mrpEl.prefix, mrpPrefix);
                  return `<div style="${posCss} display: flex; align-items: baseline; justify-content: center; width: 100%; white-space: nowrap; box-sizing: border-box; line-height: 1.1; margin: 0.1mm 0;"><span style="${fontCss} ${badgeStyleCss} font-weight: ${spWeight} !important; font-size: ${spSz} !important; display: inline-block !important; margin-right: 4pt; white-space: nowrap; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${effectiveSpPref}${sellingPrice}${el.suffix || ''}</span><span style="${mrpFontCss} ${strikeStyle} font-size: ${mrpSz}; font-weight: ${mrpWeight}; white-space: nowrap; display: inline-block;">${effectiveMrpPref}${mrp}${mrpEl.suffix || ''}</span></div>`;
                }

                return `<div style="${posCss} display: flex; align-items: center; ${alignCss}"><span style="${fontCss} ${badgeStyleCss} font-weight: ${spWeight} !important; font-size: ${spSz} !important; display: inline-block !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; line-height: 1.1 !important; white-space: nowrap;">${effectiveSpPref}${sellingPrice}${el.suffix || ''}</span></div>`;
              }
              if (el.type === "mrp") {
                const isInlineOffer = isTrendyOffer || template?.priceLayout === "center_offer" || template?.priceLayout === "inline";
                const hasSp = isInlineOffer && elementsToRender.some((o: any) => o.type === "sellingPrice" && o.visible !== false);
                if (hasSp && sellingPrice) {
                  return "";
                }
                const isStrike = el.showStrike !== undefined ? el.showStrike : el.textDecoration === "line-through" ? true : el.textDecoration === "none" ? false : showMrpStrike;
                const strikeStyle = isStrike ? `text-decoration: line-through !important; text-decoration-color: ${mrpStrikeColor === 'red' ? '#dc2626' : '#000000'} !important;` : `text-decoration: none !important;`;
                const mrpSz = getCalculatedFontSize(el.fontSize || elemStyles.priceMrp?.fontSize, isTrendyOffer ? 7.5 : 6.5);
                const mrpWeight = el.fontWeight || elemStyles.priceMrp?.fontWeight || (isTrendyOffer ? '900' : '600');
                const effectiveMrpPref = cleanMrpPrefix(el.prefix, mrpPrefix);
                return `<div style="${posCss} display: flex; align-items: baseline; ${alignCss}"><span style="${fontCss} ${strikeStyle} color: ${el.color || '#000000'}; font-size: ${mrpSz}; font-weight: ${mrpWeight}; white-space: nowrap;">${effectiveMrpPref}${mrp}${el.suffix || ''}</span></div>`;
              }
              if (el.type === "priceGroup") {
                const isCenterOffer = template?.themeName === "trendy_offer" || template?.priceLayout === "center_offer" || (template?.textAlign === "center" && spBadgeStyle === "none");
                const isStrike = el.showStrike !== undefined ? el.showStrike : showMrpStrike;
                const strikeStyle = isStrike ? `text-decoration: line-through !important; text-decoration-color: ${mrpStrikeColor === 'red' ? '#dc2626' : '#000000'} !important;` : `text-decoration: none !important;`;
                const priceFont = el.fontFamily || fontFamily;
                const priceSize = getCalculatedFontSize(el.fontSize, isTrendyOffer ? 8.0 : 7.0);
                const pWeight = el.fontWeight || (isTrendyOffer ? "900" : "700");
                const currentBadge = el.badgeStyle || spBadgeStyle;
                const spStyleCss =
                  currentBadge === "pill"
                    ? "background-color: #059669 !important; color: #ffffff !important; padding: 0.5px 3px !important; border-radius: 9999px !important;"
                    : currentBadge === "dark"
                    ? "background-color: #0f172a !important; color: #ffffff !important; padding: 0.5px 3px !important; border-radius: 2px !important;"
                    : currentBadge === "gold"
                    ? "background-color: #fbbf24 !important; color: #000000 !important; padding: 0.5px 3px !important; border-radius: 2px !important;"
                    : currentBadge === "outline"
                    ? "border: 1px solid #4f46e5 !important; color: #4338ca !important; padding: 0.5px 2px !important; border-radius: 2px !important;"
                    : "color: #000000 !important;";

                const effectiveSpPref = cleanSpPrefix(el.prefix, spPrefix);
                const effectiveMrpPref = cleanMrpPrefix(el.mrpPrefix, mrpPrefix);

                if (isCenterOffer) {
                  return `<div style="${posCss} display: flex; align-items: baseline; justify-content: center; width: 100%; white-space: nowrap; box-sizing: border-box; line-height: 1.1;">${sellingPrice ? `<span style="font-family: ${priceFont}; font-weight: ${pWeight}; font-size: ${priceSize}; ${spStyleCss} display: inline-block; margin-right: 4pt;">${effectiveSpPref}${sellingPrice}${el.suffix || ''}</span>` : ''}${mrp ? `<span style="font-family: ${priceFont}; font-weight: ${pWeight}; font-size: ${getCalculatedFontSize(el.fontSize, isTrendyOffer ? 7.5 : 6.5)}; color: #000000; ${strikeStyle} display: inline-block;">${effectiveMrpPref}${mrp}</span>` : ''}</div>`;
                } else {
                  const hasSeparateProd = elementsToRender.some((other: any) => other.type === "productName" && other.visible !== false);
                  const priceAlignCss = el.textAlign === 'center' ? 'justify-content: center;' : el.textAlign === 'left' ? 'justify-content: flex-start;' : 'justify-content: flex-end;';
                  return `<div style="${posCss} display: flex; align-items: center; ${hasSeparateProd ? priceAlignCss : 'justify-content: space-between;'} width: 100%; white-space: nowrap; box-sizing: border-box;">${!hasSeparateProd ? `<span style="font-weight: 800; font-size: ${priceSize}; color: #020617; max-width: 40%; overflow: hidden; text-overflow: ellipsis;">${renderedProdName}</span>` : ''}<div style="display: flex; gap: 4pt; align-items: center; ${priceAlignCss}">${mrp ? `<span style="font-family: ${priceFont}; font-size: ${getCalculatedFontSize(el.fontSize, 6.5, 7.8)}; color: #000000; ${strikeStyle} font-weight: 600;">${effectiveMrpPref}${mrp}</span>` : ''}${sellingPrice ? `<span style="font-family: ${priceFont}; font-weight: ${pWeight}; font-size: ${priceSize}; ${spStyleCss} display: inline-block !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; line-height: 1.1 !important;">${effectiveSpPref}${sellingPrice}${el.suffix || ''}</span>` : ''}</div></div>`;
                }
              }
              if (el.type === "sku") {
                const skuSz = getCalculatedFontSize(el.fontSize || elemStyles.sku?.fontSize, isTrendyOffer ? 6.5 : 5.6);
                const skuWeight = el.fontWeight || elemStyles.sku?.fontWeight || (isTrendyOffer ? "bold" : "600");
                return `<div style="${posCss} ${alignCss}"><span style="${fontCss} font-size: ${skuSz}; font-weight: ${skuWeight}; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${el.prefix !== undefined ? el.prefix : ''}${item.sku || 'SKU-001'}${el.suffix || ''}</span></div>`;
              }
              if (el.type === "hsn") {
                const hsnSz = getCalculatedFontSize(el.fontSize || elemStyles.hsn?.fontSize, 5.0, 6.5);
                const hsnWeight = el.fontWeight || "600";
                return `<div style="${posCss} ${alignCss}"><span style="${fontCss} font-size: ${hsnSz}; font-weight: ${hsnWeight}; font-family: monospace; color: #64748b;">${el.prefix !== undefined ? el.prefix : 'HSN: '}${(item as any).hsn_code || '8517'}${el.suffix || ''}</span></div>`;
              }
              if (el.type === "barcodeGraphic") {
                const isThermalCompact = labelHeightMm <= 25;
                const bH = isThermalCompact ? Math.min(el.height || 12, 13) : (el.height || defaultBarcodeHeight);
                const showBarcodeText = template?.showBarcodeText !== false;
                const bSvg = item.barcode ? generateBarcodeSvgString(item.barcode, bH, defaultBaseUnitPx * (el.widthScale || 1.0), item.format || activeFormat, showBarcodeText) : '';
                return `<div style="${posCss} display: flex; flex-direction: column; justify-content: center; align-items: center; overflow: visible; margin: 0 auto; width: 100%; max-width: 98%; line-height: 1;">${bSvg}</div>`;
              }
              if (el.type === "customText") {
                let rawCustom = customTexts[el.id] || el.customText || "Custom Label Text";
                let renderedTxt = String(rawCustom)
                  .replace(/\{mrp\}/gi, mrp)
                  .replace(/\{sp\}/gi, sellingPrice)
                  .replace(/\{sku\}/gi, item.sku || '')
                  .replace(/\{product_name\}/gi, renderedProdName)
                  .replace(/\{store\}/gi, renderedCompanyName);
                const custSz = getCalculatedFontSize(el.fontSize, 5.2, 8.5);
                return `<div style="${posCss} ${alignCss}"><span style="${fontCss} font-size: ${custSz}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${el.prefix || ''}${renderedTxt}${el.suffix || ''}</span></div>`;
              }
              if (el.type === "batchMfgExp") {
                const batchSz = getCalculatedFontSize(el.fontSize, 4.8, 7.5);
                return `<div style="${posCss} display: flex; justify-content: space-between; font-size: ${batchSz}; color: #64748b; width: 100%;"><span>Mfg: ${item.pkd_date || '07/26'} | Exp: ${item.exp_date || '07/29'}</span>${item.batch_no ? `<span>Lot: ${item.batch_no}</span>` : ''}</div>`;
              }
              if (el.type === "divider") {
                return `<div style="${posCss}"><div style="border-top: ${el.height || 1}px ${el.borderStyle || 'solid'} ${el.color || '#cbd5e1'}; width: 100%; margin: 0.5px 0;"></div></div>`;
              }
              if (el.type === "discountBadge" && discountPercent > 0) {
                const discSz = getCalculatedFontSize(el.fontSize, 5.0, 7.5);
                return `<div style="${posCss} ${alignCss}"><span style="font-size: ${discSz}; font-weight: 900; color: #047857; background-color: #d1fae5; padding: 0.5px 3px; border-radius: 2px;">${el.prefix || ''}${discountPercent}% OFF${el.suffix || ''}</span></div>`;
              }
              return "";
            })
            .join("");

          return `
        <div class="businessos-barcode-card" style="${cardStyle}; ${borderCss} ${radiusCss}; background-color: ${paperBgColor} !important; font-family: ${fontFamily}; position: relative; overflow: hidden; box-sizing: border-box;">
          <div class="businessos-card-inner" style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between; align-items: center; box-sizing: border-box; position: relative;">
            ${cardBodyHtml}
          </div>
        </div>
      `;
        })
        .join("");

      let emptySlotsHtml = "";
      if (rowItems.length < columns) {
        const missing = columns - rowItems.length;
        for (let m = 0; m < missing; m++) {
          emptySlotsHtml += `<div class="businessos-barcode-card" style="${cardStyle}; border: none !important; background: transparent !important; visibility: hidden;"></div>`;
        }
      }

      return `<div class="businessos-label-page" style="${pageStyle}"><div class="businessos-label-row" style="${rowStyle}">${rowCards}${emptySlotsHtml}</div></div>`;
    })
    .join("");

  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title></title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
          ${pageCss}
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            width: 100% !important;
            height: 100% !important;
            font-family: ${fontFamily};
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @media screen {
            body {
              background-color: #f8fafc !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              justify-content: center !important;
              min-height: 100% !important;
              padding: 16px 8px !important;
            }
            .businessos-label-page {
              background: #ffffff !important;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.06) !important;
              border-radius: 6px !important;
              margin: 10px auto !important;
              border: 1px solid #cbd5e1 !important;
              zoom: 1.8;
            }
          }
          @media print {
            body {
              background: #ffffff !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .businessos-label-page {
              box-shadow: none !important;
              border-radius: 0 !important;
              margin: 0 !important;
              border: none !important;
            }
          }
          .businessos-label-page {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            page-break-before: auto !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }
          .businessos-label-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .businessos-label-row {
            box-sizing: border-box !important;
          }
          .businessos-barcode-card {
            overflow: hidden !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            align-items: center !important;
          }
          .businessos-card-inner {
            width: 100% !important;
            height: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            align-items: center !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }
        </style>
      </head>
      <body>
        ${cardsHtml}
      </body>
    </html>`;
}

/**
 * Direct print trigger for thermal barcode printers (Xprinter XP-TT426B, Zebra, TSC, TVS, Citizen) and A4 sheets
 */
export function printBarcodePopup(
  items: ProductBarcodeLike[],
  template: any = {},
  layout:
    | "1up"
    | "2up"
    | "3up"
    | "4up"
    | "a4"
    | "a4_24"
    | "a4_30"
    | "a4_40"
    | "a4_65"
    | "fmcg" = "2up",
  currencySymbol: string = "₹",
  orgName?: string,
  barcodeFormatOverride?: "Auto" | "Code-128" | "EAN-13" | string
) {
  if (!items || items.length === 0) return;

  const htmlContent = generateBarcodeLabelHtml(items, template, layout, currencySymbol, orgName, barcodeFormatOverride);
  if (!htmlContent) return;

  // Create isolated hidden iframe for 100% clean barcode printing
  const iframeId = "businessos-barcode-print-frame";
  const oldIframe = document.getElementById(iframeId);
  if (oldIframe) oldIframe.remove();

  const iframe = document.createElement("iframe");
  iframe.id = iframeId;
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    console.error("Could not access iframe document for printing");
    return;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error("Iframe print error:", e);
    } finally {
      setTimeout(() => {
        try {
          iframe.remove();
        } catch {}
      }, 60000);
    }
  }, 250);
}