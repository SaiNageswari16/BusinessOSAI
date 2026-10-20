import React from "react";
import { AlertTriangle, AlertOctagon, PackageX, Trash2, ArrowRight, ShieldAlert, CheckCircle2 } from "lucide-react";

export type StockAlertMode = "zero_stock" | "low_stock" | "excess_quantity";

export interface StockAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: StockAlertMode;
  productName: string;
  sku?: string;
  availableStock: number;
  requestedQuantity: number;
  reorderLevel?: number;
  isAuthorized: boolean;
  onRemoveItem?: () => void;
  onAllowBilling?: () => void;
  onAdjustQuantity?: (quantity: number) => void;
  onRemove?: () => void;
  onAllow?: () => void;
  onAdjust?: (quantity: number) => void;
}

export const StockAlertModal: React.FC<StockAlertModalProps> = ({
  isOpen,
  onClose,
  mode,
  productName,
  sku,
  availableStock,
  requestedQuantity,
  reorderLevel,
  isAuthorized,
  onRemoveItem,
  onAllowBilling,
  onAdjustQuantity,
  onRemove,
  onAllow,
  onAdjust,
}) => {
  if (!isOpen) return null;

  const handleRemove = onRemoveItem || onRemove || onClose;
  const handleAllow = onAllowBilling || onAllow || onClose;
  const handleAdjust = onAdjustQuantity || onAdjust;

  const isZero = mode === "zero_stock";
  const isLow = mode === "low_stock";
  const isExcess = mode === "excess_quantity";

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all scale-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-alert-title"
      >
        {/* Header Ribbon */}
        <div
          className={`p-5 flex items-start gap-4 border-b ${
            isZero
              ? "bg-red-50/80 border-red-100"
              : isExcess
              ? "bg-rose-50/80 border-rose-100"
              : "bg-amber-50/80 border-amber-100"
          }`}
        >
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
              isZero
                ? "bg-red-600 text-white shadow-red-200"
                : isExcess
                ? "bg-rose-500 text-white shadow-rose-200"
                : "bg-amber-500 text-white shadow-amber-200"
            }`}
          >
            {isZero ? (
              <PackageX className="w-6 h-6 animate-pulse" />
            ) : isExcess ? (
              <AlertOctagon className="w-6 h-6 animate-pulse" />
            ) : (
              <AlertTriangle className="w-6 h-6 animate-bounce" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3
              id="stock-alert-title"
              className={`text-lg font-bold tracking-tight ${
                isZero ? "text-red-900" : isExcess ? "text-rose-900" : "text-amber-900"
              }`}
            >
              {isZero
                ? "Out of Stock Alert"
                : isExcess
                ? "Requested Quantity Exceeds Stock"
                : "Low Stock Warning"}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {isZero
                ? "Product has zero stock on hand."
                : isExcess
                ? "Requested quantity is greater than available stock."
                : `Current stock is below the threshold of ${reorderLevel ?? 5} units.`}
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Product</span>
              {sku && <span className="font-mono text-[11px] bg-slate-200/60 px-1.5 py-0.5 rounded">SKU: {sku}</span>}
            </div>
            <div className="font-bold text-slate-900 text-sm truncate" title={productName}>
              {productName}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-2xs">
                <span className="text-slate-500 block text-[11px] font-medium">Available Stock</span>
                <span
                  className={`text-base font-extrabold ${
                    availableStock <= 0 ? "text-red-600" : availableStock < 5 ? "text-amber-600" : "text-slate-800"
                  }`}
                >
                  {availableStock}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-2xs">
                <span className="text-slate-500 block text-[11px] font-medium">Requested Qty</span>
                <span className="text-base font-extrabold text-indigo-700">{requestedQuantity}</span>
              </div>
            </div>
          </div>

          {/* Authorization Notice for Zero Stock */}
          {isZero && !isAuthorized && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Zero-stock sales restricted:</span> Cashier role does not have authorization
                to bill out-of-stock items. Please remove the item or request a supervisor approval.
              </div>
            </div>
          )}

          {isZero && isAuthorized && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Authorized Override Available:</span> You have permission to override and bill
                zero-stock items if allowed by store policy.
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          {/* Action 1: Remove Item / Cancel */}
          <button
            type="button"
            onClick={handleRemove}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-700 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-300 hover:border-red-200 rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {isLow ? "Cancel / Remove Item" : "Remove Item"}
          </button>

          {/* Excess Stock Quantity Helper */}
          {isExcess && handleAdjust && availableStock > 0 && (
            <button
              type="button"
              onClick={() => handleAdjust(availableStock)}
              className="w-full sm:w-auto px-3.5 py-2 text-xs font-bold text-amber-800 bg-amber-100/80 hover:bg-amber-200 border border-amber-300 rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
            >
              Adjust Qty to {availableStock}
            </button>
          )}

          {/* Action 2: Allow Billing / Continue Billing */}
          <button
            type="button"
            onClick={handleAllow}
            disabled={isZero && !isAuthorized}
            className={`w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer ${
              isZero && !isAuthorized
                ? "bg-slate-200 text-slate-400 border border-slate-200 cursor-not-allowed"
                : isZero
                ? "bg-red-600 hover:bg-red-700 text-white shadow-red-200"
                : isExcess
                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200"
            }`}
          >
            {isZero ? (
              <>
                <ShieldAlert className="w-3.5 h-3.5" />
                Allow Billing
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Continue Billing
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
