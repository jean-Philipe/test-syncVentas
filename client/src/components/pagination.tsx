"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    className?: string;
}

const PAGE_SIZE_OPTIONS = [10, 50, 100, 500, 1000, -1]; // -1 = All

export function Pagination({
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    onPageChange,
    onPageSizeChange,
    className,
}: PaginationProps) {
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endItem = pageSize === -1 ? totalItems : Math.min(currentPage * pageSize, totalItems);

    return (
        <div className={cn("flex items-center justify-between gap-4 py-3 px-4 bg-white border border-slate-200 rounded-lg shadow-sm", className)}>
            {/* Items per page selector */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Mostrar</span>
                <select
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    className="px-2 py-1 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                            {size === -1 ? "Todos" : size}
                        </option>
                    ))}
                </select>
                <span className="text-sm text-slate-600">por página</span>
            </div>

            {/* Item count info */}
            <div className="text-sm text-slate-600">
                {pageSize === -1 ? (
                    <span>Mostrando <span className="font-semibold">{totalItems}</span> productos</span>
                ) : (
                    <span>
                        <span className="font-semibold">{startItem}</span> - <span className="font-semibold">{endItem}</span> de{" "}
                        <span className="font-semibold">{totalItems}</span>
                    </span>
                )}
            </div>

            {/* Page navigation */}
            {pageSize !== -1 && totalPages > 1 && (
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onPageChange(1)}
                        disabled={currentPage === 1}
                        className={cn(
                            "p-1.5 rounded-md transition-colors",
                            currentPage === 1
                                ? "text-slate-300 cursor-not-allowed"
                                : "text-slate-600 hover:bg-slate-100"
                        )}
                        title="Primera página"
                    >
                        <ChevronsLeft className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={cn(
                            "p-1.5 rounded-md transition-colors",
                            currentPage === 1
                                ? "text-slate-300 cursor-not-allowed"
                                : "text-slate-600 hover:bg-slate-100"
                        )}
                        title="Página anterior"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>

                    <div className="flex items-center gap-1 mx-2">
                        <span className="text-sm text-slate-600">Página</span>
                        <input
                            type="number"
                            min={1}
                            max={totalPages}
                            value={currentPage}
                            onChange={(e) => {
                                const page = parseInt(e.target.value);
                                if (page >= 1 && page <= totalPages) {
                                    onPageChange(page);
                                }
                            }}
                            className="w-14 px-2 py-1 text-sm text-center border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-600">de {totalPages}</span>
                    </div>

                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={cn(
                            "p-1.5 rounded-md transition-colors",
                            currentPage === totalPages
                                ? "text-slate-300 cursor-not-allowed"
                                : "text-slate-600 hover:bg-slate-100"
                        )}
                        title="Página siguiente"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => onPageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        className={cn(
                            "p-1.5 rounded-md transition-colors",
                            currentPage === totalPages
                                ? "text-slate-300 cursor-not-allowed"
                                : "text-slate-600 hover:bg-slate-100"
                        )}
                        title="Última página"
                    >
                        <ChevronsRight className="h-4 w-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
