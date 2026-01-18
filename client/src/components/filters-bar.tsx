"use client";

import { cn } from "@/lib/utils";
import { Search, Filter, X } from "lucide-react";

interface FiltersBarProps {
    marca: string;
    onMarcaChange: (value: string) => void;
    meses: number;
    onMesesChange: (value: number) => void;
    busqueda: string;
    onBusquedaChange: (value: string) => void;
    ocultarCero: boolean;
    onOcultarCeroChange: (value: boolean) => void;
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
