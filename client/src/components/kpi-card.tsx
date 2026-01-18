"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: LucideIcon;
    trend?: "up" | "down" | "neutral";
    className?: string;
}

export function KPICard({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    className,
}: KPICardProps) {
    return (
        <div
            className={cn(
                "bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow",
                className
            )}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500">{title}</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
                    {subtitle && (
                        <p
                            className={cn(
                                "mt-1 text-sm",
                                trend === "up" && "text-green-600",
                                trend === "down" && "text-red-600",
                                trend === "neutral" && "text-slate-500"
                            )}
                        >
                            {subtitle}
                        </p>
                    )}
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                    <Icon className="h-6 w-6 text-blue-600" />
                </div>
            </div>
        </div>
    );
}
