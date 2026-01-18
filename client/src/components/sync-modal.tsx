"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

interface SyncModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type StepStatus = "pending" | "loading" | "success" | "error";

interface Step {
    id: string;
    label: string;
    status: StepStatus;
    detail?: string;
}

const INITIAL_STEPS: Step[] = [
    { id: "products", label: "Catálogo de Productos", status: "pending" },
    { id: "sales", label: "Ventas del Día Anterior", status: "pending" },
    { id: "data", label: "Stock y Datos Mes Actual", status: "pending" },
];

export function SyncModal({ isOpen, onClose }: SyncModalProps) {
    const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
    const [completed, setCompleted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setSteps(INITIAL_STEPS);
            setCompleted(false);
            setError(null);
            return;
        }

        // Guard: Don't start a new stream if already completed
        if (completed) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api";

        // Determinar URL del stream
        // En desarrollo local, conectamos directo al backend (puerto 3000) para evitar 
        // que el proxy de Next.js (puerto 3001) bufferee la respuesta SSE.
        let streamUrl = `${apiUrl}/dashboard/sync-stream`;
        if (typeof window !== "undefined" && window.location.hostname === "localhost" && window.location.port !== "3000") {
            streamUrl = "http://localhost:3000/api/dashboard/sync-stream";
        }

        console.log("Conectando SSE a:", streamUrl);
        const eventSource = new EventSource(streamUrl);

        const updateStep = (id: string, status: StepStatus, detail?: string) => {
            setSteps((prev) =>
                prev.map((s) => (s.id === id ? { ...s, status, detail: detail || s.detail } : s))
            );
        };

        eventSource.onopen = () => {
            // Conexión establecida
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                switch (data.step) {
                    case "start":
                        // Init
                        break;

                    case "products":
                        updateStep("products", "loading", data.message);
                        break;
                    case "products_done":
                        updateStep("products", "success", data.message);
                        break;

                    case "sales":
                        updateStep("sales", "loading", data.message);
                        break;
                    case "sales_done":
                        updateStep("sales", "success", data.message);
                        break;

                    case "data":
                        updateStep("data", "loading", data.message);
                        break;
                    case "data_done":
                        updateStep("data", "success", data.message);
                        break;

                    case "complete":
                        setCompleted(true);
                        eventSource.close();
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                        break;

                    case "error":
                        setError(data.message);
                        eventSource.close();
                        break;
                }
            } catch (e) {
                console.error("Error parsing SSE", e);
            }
        };

        eventSource.onerror = () => {
            // El servidor cerró la conexión o hubo un error de red
            // No hacemos nada aquí porque el 'complete' ya maneja el cierre normal
        };

        return () => {
            eventSource.close();
        };
    }, [isOpen]); // Removed 'completed' from dependencies to prevent double-trigger

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 m-4 animate-in zoom-in-95 duration-200 border border-slate-200">

                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Loader2 className={cn("h-5 w-5 text-indigo-600", !completed && !error && "animate-spin")} />
                        Sincronizando con Manager+
                    </h2>
                    {!completed && !error && (
                        <div className="p-2 bg-indigo-50 rounded-full">
                            <div className="h-2 w-2 bg-indigo-600 rounded-full animate-ping" />
                        </div>
                    )}
                </div>

                {error ? (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-red-700 flex items-start gap-3 mb-6">
                        <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-semibold">Ocurrió un error</p>
                            <p>{error}</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 mb-8">
                        {steps.map((step) => (
                            <div key={step.id} className="group">
                                <div className="flex items-center gap-3 mb-1">
                                    <div className={cn(
                                        "flex items-center justify-center h-8 w-8 rounded-full border-2 transition-colors",
                                        step.status === "pending" && "border-slate-200 text-slate-300",
                                        step.status === "loading" && "border-indigo-600 text-indigo-600",
                                        step.status === "success" && "border-emerald-500 bg-emerald-50 text-emerald-600",
                                        step.status === "error" && "border-red-500 text-red-500"
                                    )}>
                                        {step.status === "pending" && <div className="h-2 w-2 rounded-full bg-slate-300" />}
                                        {step.status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
                                        {step.status === "success" && <CheckCircle2 className="h-5 w-5" />}
                                    </div>
                                    <div className="flex-1">
                                        <p className={cn(
                                            "font-medium text-sm",
                                            step.status === "pending" && "text-slate-500",
                                            step.status === "loading" && "text-indigo-700",
                                            step.status === "success" && "text-slate-800",
                                            step.status === "error" && "text-red-700"
                                        )}>
                                            {step.label}
                                        </p>
                                    </div>
                                </div>
                                {step.detail && (
                                    <div className="ml-11 text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 font-mono">
                                        <Terminal className="h-3 w-3 inline mr-1 opacity-50" />
                                        {step.detail}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {completed && (
                    <div className="flex items-center justify-center gap-2 text-emerald-600 font-medium animate-pulse">
                        <CheckCircle2 className="h-5 w-5" />
                        ¡Listo! Recargando...
                    </div>
                )}

                {/* Close button only on error */}
                {error && (
                    <button
                        onClick={onClose}
                        className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                    >
                        Cerrar
                    </button>
                )}
            </div>
        </div>
    );
}
