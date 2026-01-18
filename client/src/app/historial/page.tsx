"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSyncHistory, SyncLog } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { RefreshCw, History, Package, FileText, Database, Clock, ChevronLeft, ChevronRight } from "lucide-react";

// Mapeo de nombres de meses en español
const MESES = [
    "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// Mapeo de tipos de sincronización a texto legible
const TIPO_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
    ventas_actuales: { label: "Ventas del Mes", icon: FileText, color: "text-green-500 bg-green-500/10" },
    ventas_historicas: { label: "Ventas Históricas", icon: Database, color: "text-blue-500 bg-blue-500/10" },
    productos: { label: "Catálogo Productos", icon: Package, color: "text-purple-500 bg-purple-500/10" },
    stock: { label: "Stock", icon: Database, color: "text-orange-500 bg-orange-500/10" },
};

// Opciones de paginación
const PAGE_SIZE_OPTIONS = [5, 10, 20];

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("es-CL", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

function SyncLogRow({ log }: { log: SyncLog }) {
    const tipoInfo = TIPO_LABELS[log.tipo] || { label: log.tipo, icon: Clock, color: "text-slate-500 bg-slate-500/10" };
    const Icon = tipoInfo.icon;
    const mesLabel = `${MESES[log.mesTarget]} ${log.anoTarget}`;

    return (
        <tr className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
            {/* Fecha y Hora */}
            <td className="px-4 py-3">
                <div className="flex flex-col">
                    <span className="font-medium text-slate-900">{formatDate(log.createdAt)}</span>
                    <span className="text-sm text-slate-500">{formatTime(log.createdAt)}</span>
                </div>
            </td>

            {/* Tipo */}
            <td className="px-4 py-3">
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${tipoInfo.color}`}>
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{tipoInfo.label}</span>
                </div>
            </td>

            {/* Mes Afectado */}
            <td className="px-4 py-3">
                <span className="font-medium text-slate-700">{mesLabel}</span>
            </td>


            {/* Productos (Total) */}
            <td className="px-4 py-3 text-center">
                <span className="text-slate-900 font-mono">{log.productos}</span>
            </td>

            {/* Productos Con Ventas */}
            <td className="px-4 py-3 text-center">
                <span className="text-green-700 font-mono font-medium">{log.productosConVentas}</span>
            </td>

            {/* Mensaje */}
            <td className="px-4 py-3">
                {log.mensaje ? (
                    <span className="text-sm text-slate-600">{log.mensaje}</span>
                ) : (
                    <span className="text-sm text-slate-400 italic">—</span>
                )}
            </td>
        </tr>
    );
}

export default function HistorialPage() {
    const [isManualRefreshing, setIsManualRefreshing] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const { data, isLoading, error, isFetching, refetch } = useQuery({
        queryKey: ["sync-history"],
        queryFn: () => fetchSyncHistory(500), // Traemos más registros para la paginación client-side
        staleTime: 0,
        refetchInterval: 30000,
    });

    const handleRefresh = useCallback(async () => {
        setIsManualRefreshing(true);
        try {
            await refetch();
        } finally {
            // Dar un pequeño delay para que la animación sea visible
            setTimeout(() => {
                setIsManualRefreshing(false);
            }, 500);
        }
    }, [refetch]);

    // Calcular paginación
    const allLogs = data?.logs || [];
    const totalItems = allLogs.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedLogs = allLogs.slice(startIndex, endIndex);

    // Cambiar página size resetea a página 1
    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setCurrentPage(1);
    };

    const showSpinner = isFetching || isManualRefreshing;

    return (
        <div className="flex h-screen bg-slate-100">
            <Sidebar />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm">
                    <div className="flex items-center gap-3">
                        <History className="h-6 w-6 text-blue-600" />
                        <h1 className="text-xl font-bold text-slate-900">Historial de Sincronizaciones</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-500">
                            Auto-refresh: 30s
                        </span>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={showSpinner}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <RefreshCw className={`h-4 w-4 ${showSpinner ? "animate-spin" : ""}`} />
                            {showSpinner ? "Actualizando..." : "Actualizar"}
                        </button>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 overflow-auto p-6">
                    {/* Info Card */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-4 mb-6">
                        <p className="text-blue-800">
                            📊 Este registro muestra cada vez que se actualizan las ventas del mes actual en la base de datos.
                            Cada entrada indica cuándo se ingresaron nuevas notas de ventas y para qué mes.
                        </p>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            </div>
                        ) : error ? (
                            <div className="flex items-center justify-center h-64 text-red-600">
                                Error al cargar historial: {(error as Error).message}
                            </div>
                        ) : allLogs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                                <History className="h-12 w-12 mb-4 text-slate-300" />
                                <p className="text-lg font-medium">No hay sincronizaciones registradas</p>
                                <p className="text-sm">Las sincronizaciones aparecerán aquí cuando se ejecuten.</p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                    Fecha y Hora
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                    Tipo
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                    Mes Afectado
                                                </th>

                                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                    Productos (Total)
                                                </th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-green-600 uppercase tracking-wider">
                                                    Con Ventas
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                    Mensaje
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedLogs.map((log) => (
                                                <SyncLogRow key={log.id} log={log} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination Controls */}
                                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
                                    {/* Page Size Selector */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-slate-600">Mostrar:</span>
                                        <select
                                            value={pageSize}
                                            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                                            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {PAGE_SIZE_OPTIONS.map((size) => (
                                                <option key={size} value={size}>
                                                    {size} por página
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Info */}
                                    <div className="text-sm text-slate-600">
                                        Mostrando {startIndex + 1} - {Math.min(endIndex, totalItems)} de {totalItems} registros
                                    </div>

                                    {/* Page Navigation */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronLeft className="h-4 w-4 text-slate-600" />
                                        </button>

                                        <span className="px-3 py-1.5 text-sm font-medium text-slate-700">
                                            Página {currentPage} de {totalPages}
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronRight className="h-4 w-4 text-slate-600" />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
