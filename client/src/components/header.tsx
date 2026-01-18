"use client";

import { cn } from "@/lib/utils";
import { RefreshCw, Clock, Trash2, DownloadCloud } from "lucide-react";

interface HeaderProps {
    className?: string;
    lastUpdate?: string;
    isLoading?: boolean;
    onRefresh?: () => void;
    onReset?: () => void;
    isResetting?: boolean;
    onSyncProducts?: () => void;
    isSyncing?: boolean;
}

export function Header({
    className,
    lastUpdate,
    isLoading,
    onRefresh,
    onReset,
    isResetting,
    onSyncProducts,
    isSyncing
}: HeaderProps) {
    return (
        <header
            className={cn(
                "flex items-center justify-between h-16 px-6 bg-white border-b border-slate-200",
                className
            )}
        >
            <div>
                <h1 className="text-xl font-semibold text-slate-800">
                    Sistema de Órdenes de Compra
                </h1>
                <p className="text-sm text-slate-500">
                    Gestión inteligente de inventario y pedidos
                </p>
            </div>

            <div className="flex items-center gap-3">
                {lastUpdate && (
                    <div className="flex items-center gap-2 text-sm text-slate-500 mr-2">
                        <Clock className="h-4 w-4" />
                        <span>Última actualización: {lastUpdate}</span>
                    </div>
                )}

                {/* Botón Sincronizar Productos (Nuevo) */}
                {onSyncProducts && (
                    <button
                        onClick={onSyncProducts}
                        disabled={isSyncing || isLoading}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-lg border border-indigo-200",
                            "hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                        title="Buscar nuevos productos en Manager+ y actualizar ventas actuales"
                    >
                        <DownloadCloud className={cn("h-4 w-4", isSyncing && "animate-bounce")} />
                        {isSyncing ? "Sincronizando..." : "Sincronizar Manager+"}
                    </button>
                )}

                {/* Botón Reset */}
                {onReset && (
                    <button
                        onClick={onReset}
                        disabled={isResetting || isSyncing}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-200",
                            "hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                        title="Reiniciar todas las compras a 0"
                    >
                        <Trash2 className={cn("h-4 w-4", isResetting && "animate-pulse")} />
                        Reiniciar Compras
                    </button>
                )}

                {/* Botón Actualizar */}
                <button
                    onClick={onRefresh}
                    disabled={isLoading || isSyncing}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg",
                        "hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                    title="Recargar datos del servidor"
                >
                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    Actualizar
                </button>
            </div>
        </header>
    );
}
