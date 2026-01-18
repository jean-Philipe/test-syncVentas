"use client";

import { cn } from "@/lib/utils";
import { Search, Filter, X, ChevronDown, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";

// Tipos de estado posibles
export type StockStatus = "overstock" | "critical" | "warning" | "healthy" | "excess";

export const STATUS_OPTIONS: { value: StockStatus; label: string; color: string }[] = [
    { value: "overstock", label: "Sobrestock", color: "bg-purple-100 text-purple-700" },
    { value: "critical", label: "Crítico", color: "bg-red-100 text-red-700" },
    { value: "warning", label: "Bajo", color: "bg-amber-100 text-amber-700" },
    { value: "healthy", label: "OK", color: "bg-green-100 text-green-700" },
    { value: "excess", label: "Exceso", color: "bg-blue-100 text-blue-700" },
];

// Función para calcular el estado de un producto
export function calculateProductStatus(stock: number, promedio: number, sugerido: number): StockStatus {
    if (sugerido < 0) return "overstock";
    const ratio = promedio > 0 ? stock / promedio : stock > 0 ? Infinity : 0;
    if (ratio < 0.5) return "critical";
    if (ratio < 1) return "warning";
    if (ratio <= 2) return "healthy";
    return "excess";
}

interface MultiSelectProps {
    selected: StockStatus[];
    onChange: (values: StockStatus[]) => void;
}

function StatusMultiSelect({ selected, onChange }: MultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const isAllSelected = selected.length === 0;

    const handleToggle = (value: StockStatus) => {
        if (selected.includes(value)) {
            onChange(selected.filter((v) => v !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    const handleSelectAll = () => {
        onChange([]);
    };

    const getDisplayText = () => {
        if (isAllSelected) return "Todos";
        if (selected.length === 1) {
            return STATUS_OPTIONS.find((o) => o.value === selected[0])?.label || "";
        }
        return `${selected.length} seleccionados`;
    };

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center justify-between gap-2 w-44 px-3 py-2 text-sm border rounded-lg bg-white transition-colors",
                    "hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500",
                    isOpen ? "border-blue-500 ring-2 ring-blue-500" : "border-slate-200"
                )}
            >
                <span className={cn(isAllSelected ? "text-slate-600" : "text-slate-900 font-medium")}>
                    {getDisplayText()}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                    {/* Select All Option */}
                    <button
                        type="button"
                        onClick={handleSelectAll}
                        className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors",
                            isAllSelected && "bg-blue-50"
                        )}
                    >
                        <div className={cn(
                            "h-4 w-4 rounded border flex items-center justify-center",
                            isAllSelected ? "bg-blue-600 border-blue-600" : "border-slate-300"
                        )}>
                            {isAllSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span className="text-slate-700 font-medium">Todos los estados</span>
                    </button>

                    <div className="border-t border-slate-100 my-1" />

                    {/* Individual Options */}
                    {STATUS_OPTIONS.map((option) => {
                        const isSelected = selected.includes(option.value);
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleToggle(option.value)}
                                className={cn(
                                    "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors",
                                    isSelected && "bg-slate-50"
                                )}
                            >
                                <div className={cn(
                                    "h-4 w-4 rounded border flex items-center justify-center",
                                    isSelected ? "bg-blue-600 border-blue-600" : "border-slate-300"
                                )}>
                                    {isSelected && <Check className="h-3 w-3 text-white" />}
                                </div>
                                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", option.color)}>
                                    {option.label}
                                </span>
                            </button>
                        );
                    })}

                    {/* Clear Selection */}
                    {selected.length > 0 && (
                        <>
                            <div className="border-t border-slate-100 my-1" />
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
                            >
                                <X className="h-4 w-4" />
                                Limpiar filtro
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

interface FiltersBarProps {
    marca: string;
    onMarcaChange: (value: string) => void;
    meses: number;
    onMesesChange: (value: number) => void;
    busqueda: string;
    onBusquedaChange: (value: string) => void;
    ocultarCero: boolean;
    onOcultarCeroChange: (value: boolean) => void;
    estadosSeleccionados: StockStatus[];
    onEstadosChange: (values: StockStatus[]) => void;
    totalProductos: number;
    productosVisibles: number;
    className?: string;
}

export function FiltersBar({
    marca,
    onMarcaChange,
    meses,
    onMesesChange,
    busqueda,
    onBusquedaChange,
    ocultarCero,
    onOcultarCeroChange,
    estadosSeleccionados,
    onEstadosChange,
    totalProductos,
    productosVisibles,
    className,
}: FiltersBarProps) {
    return (
        <div className={cn("bg-white rounded-xl border border-slate-200 p-4 shadow-sm", className)}>
            <div className="flex flex-wrap items-center gap-4">
                {/* Marca */}
                <div className="flex flex-col gap-1">
                    <label htmlFor="marca" className="text-xs font-medium text-slate-500">
                        Marca
                    </label>
                    <input
                        id="marca"
                        type="text"
                        value={marca}
                        onChange={(e) => onMarcaChange(e.target.value)}
                        placeholder="Ej: KC"
                        className="w-24 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Período */}
                <div className="flex flex-col gap-1">
                    <label htmlFor="meses" className="text-xs font-medium text-slate-500">
                        Período
                    </label>
                    <select
                        id="meses"
                        value={meses}
                        onChange={(e) => onMesesChange(Number(e.target.value))}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        <option value={3}>3 meses</option>
                        <option value={6}>6 meses</option>
                        <option value={12}>12 meses</option>
                    </select>
                </div>

                {/* Estado Multi-Select */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-500">
                        Estado
                    </label>
                    <StatusMultiSelect
                        selected={estadosSeleccionados}
                        onChange={onEstadosChange}
                    />
                </div>

                {/* Búsqueda */}
                <div className="flex flex-col gap-1 flex-1 min-w-[200px] max-w-md">
                    <label htmlFor="busqueda" className="text-xs font-medium text-slate-500">
                        Buscar
                    </label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            id="busqueda"
                            type="text"
                            value={busqueda}
                            onChange={(e) => onBusquedaChange(e.target.value)}
                            placeholder="SKU, descripción o familia..."
                            className="w-full pl-10 pr-10 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {busqueda && (
                            <button
                                onClick={() => onBusquedaChange("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Checkbox Ocultar cero */}
                <div className="flex items-center gap-2 pt-5">
                    <input
                        id="ocultarCero"
                        type="checkbox"
                        checked={ocultarCero}
                        onChange={(e) => onOcultarCeroChange(e.target.checked)}
                        className="h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="ocultarCero" className="text-sm text-slate-600">
                        Ocultar sin ventas
                    </label>
                </div>

                {/* Contador */}
                <div className="flex items-center gap-2 ml-auto pt-5">
                    <Filter className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-600">
                        <span className="font-semibold">{productosVisibles}</span>
                        {productosVisibles !== totalProductos && (
                            <span className="text-slate-400"> de {totalProductos}</span>
                        )}
                        {" productos"}
                    </span>
                </div>
            </div>
        </div>
    );
}
