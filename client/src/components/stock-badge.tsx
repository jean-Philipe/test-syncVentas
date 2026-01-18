"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface StockBadgeProps {
    stock: number;
    promedio: number;
    sugerido?: number;
    className?: string;
}

type StockStatus = "critical" | "warning" | "healthy" | "excess" | "overstock";

interface StatusConfig {
    label: string;
    description: string;
    formula: string;
    styles: string;
}

const STATUS_CONFIG: Record<StockStatus, StatusConfig> = {
    overstock: {
        label: "Sobrestock",
        description: "Tienes más stock del necesario para cubrir el mes",
        formula: "Sugerido < 0 → Stock + Ventas > Promedio",
        styles: "bg-purple-100 text-purple-700 border-purple-200",
    },
    critical: {
        label: "Crítico",
        description: "Stock muy bajo, riesgo de quiebre",
        formula: "Stock < 50% del Promedio",
        styles: "bg-red-100 text-red-700 border-red-200",
    },
    warning: {
        label: "Bajo",
        description: "Stock bajo, podría agotarse pronto",
        formula: "Stock entre 50% y 100% del Promedio",
        styles: "bg-amber-100 text-amber-700 border-amber-200",
    },
    healthy: {
        label: "OK",
        description: "Stock en niveles saludables",
        formula: "Stock entre 100% y 200% del Promedio",
        styles: "bg-green-100 text-green-700 border-green-200",
    },
    excess: {
        label: "Exceso",
        description: "Stock alto respecto al promedio de ventas",
        formula: "Stock > 200% del Promedio",
        styles: "bg-blue-100 text-blue-700 border-blue-200",
    },
};

function calculateStatus(stock: number, promedio: number, sugerido?: number): StockStatus {
    // Si el sugerido es negativo, significa sobrestock
    if (sugerido !== undefined && sugerido < 0) {
        return "overstock";
    }

    // Calcular ratio stock/promedio para los demás estados
    const ratio = promedio > 0 ? stock / promedio : stock > 0 ? Infinity : 0;

    if (ratio < 0.5) {
        return "critical";
    } else if (ratio < 1) {
        return "warning";
    } else if (ratio <= 2) {
        return "healthy";
    } else {
        return "excess";
    }
}

export function StockBadge({ stock, promedio, sugerido, className }: StockBadgeProps) {
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const [mounted, setMounted] = useState(false);

    const status = calculateStatus(stock, promedio, sugerido);
    const config = STATUS_CONFIG[status];
    const ratio = promedio > 0 ? (stock / promedio * 100).toFixed(0) : "∞";

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleMouseEnter = (e: React.MouseEvent<HTMLSpanElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltipPosition({
            top: rect.top - 8, // 8px above the badge
            left: rect.left + rect.width / 2,
        });
        setShowTooltip(true);
    };

    const handleMouseLeave = () => {
        setShowTooltip(false);
    };

    const tooltipContent = showTooltip && mounted && (
        <div
            className="fixed z-[9999] w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl pointer-events-none"
            style={{
                top: tooltipPosition.top,
                left: tooltipPosition.left,
                transform: 'translate(-50%, -100%)',
            }}
        >
            <div className="font-semibold mb-1">{config.label}</div>
            <div className="text-slate-300 mb-2">{config.description}</div>
            <div className="border-t border-slate-600 pt-2 mt-2 space-y-1">
                <div className="flex justify-between">
                    <span className="text-slate-400">Fórmula:</span>
                    <span className="text-slate-200">{config.formula}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-400">Stock/Promedio:</span>
                    <span className="text-slate-200">{ratio}%</span>
                </div>
                {sugerido !== undefined && (
                    <div className="flex justify-between">
                        <span className="text-slate-400">Sugerido:</span>
                        <span className={cn(
                            sugerido < 0 ? "text-purple-300" : "text-green-300"
                        )}>
                            {sugerido}
                        </span>
                    </div>
                )}
            </div>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
    );

    return (
        <>
            <span
                className={cn(
                    "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border cursor-help",
                    config.styles,
                    className
                )}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {config.label}
            </span>

            {/* Portal tooltip to body to avoid z-index issues */}
            {mounted && showTooltip && createPortal(tooltipContent, document.body)}
        </>
    );
}

// Leyenda exportable para mostrar en el dashboard
export function StockLegend({ className }: { className?: string }) {
    const statuses: StockStatus[] = ["overstock", "critical", "warning", "healthy", "excess"];

    return (
        <div className={cn("flex flex-wrap gap-3 text-xs", className)}>
            {statuses.map((status) => {
                const config = STATUS_CONFIG[status];
                return (
                    <div key={status} className="flex items-center gap-1.5">
                        <span className={cn(
                            "inline-flex items-center px-2 py-0.5 font-medium rounded-full border",
                            config.styles
                        )}>
                            {config.label}
                        </span>
                        <span className="text-slate-500">{config.formula}</span>
                    </div>
                );
            })}
        </div>
    );
}
