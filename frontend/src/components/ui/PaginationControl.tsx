import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "./button";

export interface PaginationControlProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  itemLabel?: string;
}

export function PaginationControl({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = "",
  itemLabel = "entries",
}: PaginationControlProps) {
  if (totalItems === 0) return null;

  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate visible page numbers with ellipses
  const getVisiblePages = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    pages.push(1);

    if (currentPage > 3) {
      pages.push("...");
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push("...");
    }

    pages.push(totalPages);
    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-3.5 px-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 select-none ${className}`}
    >
      {/* Left: Entries Counter & Page Size Selector */}
      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <div className="font-medium text-slate-500 dark:text-slate-400">
          Showing <span className="font-bold text-slate-800 dark:text-slate-200">{startItem}</span> to{" "}
          <span className="font-bold text-slate-800 dark:text-slate-200">{endItem}</span> of{" "}
          <span className="font-black text-indigo-600 dark:text-indigo-400">{totalItems}</span> {itemLabel}
        </div>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-[11px] text-slate-400">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Page Navigation Buttons */}
      <div className="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-end overflow-x-auto">
        {/* First Page */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          className="h-8 w-8 rounded-lg border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
          title="First Page"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>

        {/* Prev Page */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="h-8 w-8 rounded-lg border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
          title="Previous Page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>

        {/* Numeric Buttons */}
        <div className="flex items-center gap-1 mx-1">
          {visiblePages.map((p, idx) => {
            if (p === "...") {
              return (
                <span key={`dots-${idx}`} className="px-1.5 py-1 text-slate-400 font-bold tracking-widest text-[10px]">
                  •••
                </span>
              );
            }
            const pageNum = Number(p);
            const isActive = pageNum === currentPage;
            return (
              <button
                key={`page-${pageNum}`}
                onClick={() => onPageChange(pageNum)}
                className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-xs shadow-indigo-600/30 font-black scale-105"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="h-8 w-8 rounded-lg border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
          title="Next Page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>

        {/* Last Page */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          className="h-8 w-8 rounded-lg border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
          title="Last Page"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
