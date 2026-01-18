"use client";

import { ProductoDashboard, saveOrders } from "@/lib/api";
import { cn } from "@/lib/utils";
import { StockBadge } from "./stock-badge";
import { useState, useCallback, useRef, useEffect } from "react";

interface ProductTableProps {
    productos: ProductoDashboard[];
    columnas: string[];
    onOrderUpdated?: () => void;
}

function formatNumber(num: number | null | undefined): string {
    if (num === null || num === undefined) return "0";
    const n = Number(num);
    if (isNaN(n)) return "0";
    return n.toLocaleString("es-CL");
}

interface EditableCellProps {
    productoId: number;
    initialValue: number | null;
    onSave: (productoId: number, value: number) => Promise<void>;
}

function EditableCell({ productoId, initialValue, onSave }: EditableCellProps) {
    const [value, setValue] = useState<string>(initialValue?.toString() ?? "");
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanged, setHasChanged] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const originalValue = useRef(initialValue);

    useEffect(() => {
        setValue(initialValue?.toString() ?? "");
        originalValue.current = initialValue;
    }, [initialValue]);

    const handleSave = useCallback(async (newValue: string) => {
        const numValue = newValue === "" ? 0 : parseFloat(newValue);
        if (isNaN(numValue) || numValue < 0) {
            setValue(originalValue.current?.toString() ?? "");
            return;
        }

        if (numValue === originalValue.current) {
            setHasChanged(false);
            return;
        }

        setIsSaving(true);
        try {
            await onSave(productoId, numValue);
            originalValue.current = numValue;
            setHasChanged(false);
        } catch (error) {
            setValue(originalValue.current?.toString() ?? "");
            console.error("Error guardando:", error);
        } finally {
            setIsSaving(false);
        }
    }, [onSave, productoId]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setValue(newValue);
        setHasChanged(true);

        // Debounce auto-save
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            handleSave(newValue);
        }, 800);
    }, [handleSave]);

    const handleBlur = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        if (hasChanged) {
            handleSave(value);
        }
    }, [hasChanged, value, handleSave]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.currentTarget.blur();
        }
    }, []);

    return (
        <input
            type="text"
            inputMode="numeric"
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={cn(
                "w-full px-2 py-1 text-right bg-amber-50 border border-transparent rounded",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white",
                "hover:border-amber-300 transition-colors",
                isSaving && "opacity-50"
            )}
            disabled={isSaving}
        />
    );
}

export function ProductTable({ productos, columnas, onOrderUpdated }: ProductTableProps) {
    const handleSaveOrder = useCallback(async (productoId: number, cantidad: number) => {
        await saveOrders([{ productoId, cantidad }]);
        onOrderUpdated?.();
    }, [onOrderUpdated]);

    if (productos.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-500">
                No se encontraron productos
            </div>
        );
    }

    return (
        <div className="overflow-auto max-h-[calc(100vh-320px)] rounded-lg border border-slate-200 shadow-sm">
            <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-30">
                    <tr className="bg-slate-100">
                        <th className="sticky left-0 z-40 bg-slate-100 px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200 min-w-[120px]">
                            SKU
                        </th>
                        <th className="sticky left-[120px] z-40 bg-slate-100 px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200 min-w-[250px]">
                            Descripción
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200 min-w-[100px]">
                            Familia
                        </th>
                        {/* Columnas históricas */}
                        {columnas.map((col) => (
                            <th
                                key={col}
                                className="px-4 py-3 text-right font-semibold text-slate-700 border-b border-slate-200 min-w-[90px]"
                            >
                                {col}
                            </th>
                        ))}
                        {/* Mes Actual */}
                        <th className="px-4 py-3 text-right font-semibold text-blue-700 bg-blue-50 border-b border-blue-200 border-l-2 border-l-blue-400 min-w-[100px]">
                            Venta Mes
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-blue-700 bg-blue-50 border-b border-blue-200 min-w-[90px]">
                            Stock
                        </th>
                        <th className="px-4 py-3 text-center font-semibold text-blue-700 bg-blue-50 border-b border-blue-200 min-w-[80px]">
                            Estado
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-blue-700 bg-blue-50 border-b border-blue-200 min-w-[110px]">
                            Sugerido
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-amber-700 bg-amber-50 border-b border-amber-200 min-w-[110px]">
                            A Comprar
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {productos.map((item, idx) => {
                        const compraSugerida = item.compraSugerida || 0;

                        return (
                            <tr
                                key={item.producto.id}
                                className={cn(
                                    "hover:bg-slate-50 transition-colors",
                                    idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                                )}
                            >
                                <td className={cn(
                                    "sticky left-0 z-20 px-4 py-2 font-medium text-slate-800 border-b border-slate-100",
                                    idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                                )}>
                                    {item.producto.sku}
                                </td>
                                <td className={cn(
                                    "sticky left-[120px] z-20 px-4 py-2 text-slate-600 border-b border-slate-100 max-w-[300px] truncate shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]",
                                    idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                                )}>
                                    {item.producto.descripcion}
                                </td>
                                <td className="px-4 py-2 text-slate-500 border-b border-slate-100">
                                    {item.producto.familia || "-"}
                                </td>
                                {/* Ventas históricas */}
                                {item.ventasMeses.map((mes, i) => (
                                    <td
                                        key={i}
                                        className="px-4 py-2 text-right text-slate-600 border-b border-slate-100 tabular-nums"
                                    >
                                        {formatNumber(mes.cantidad)}
                                    </td>
                                ))}
                                {/* Mes actual */}
                                <td className="px-4 py-2 text-right text-slate-800 font-medium border-b border-blue-100 bg-blue-50/30 border-l-2 border-l-blue-400 tabular-nums">
                                    {formatNumber(item.mesActual?.ventaActual)}
                                </td>
                                <td className="px-4 py-2 text-right text-slate-800 border-b border-blue-100 bg-blue-50/30 tabular-nums">
                                    {formatNumber(item.mesActual?.stockActual)}
                                </td>
                                <td className="px-4 py-2 text-center border-b border-blue-100 bg-blue-50/30">
                                    <StockBadge
                                        stock={item.mesActual?.stockActual || 0}
                                        promedio={item.promedio || 0}
                                        sugerido={compraSugerida}
                                    />
                                </td>
                                <td
                                    className={cn(
                                        "px-4 py-2 text-right border-b border-blue-100 bg-blue-50/30 tabular-nums font-medium",
                                        compraSugerida > 0 && "text-green-600",
                                        compraSugerida < 0 && "text-red-600"
                                    )}
                                >
                                    {formatNumber(compraSugerida)}
                                </td>
                                <td className="px-4 py-2 border-b border-amber-100 bg-amber-50/30">
                                    <EditableCell
                                        productoId={item.producto.id}
                                        initialValue={item.compraRealizar}
                                        onSave={handleSaveOrder}
                                    />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
