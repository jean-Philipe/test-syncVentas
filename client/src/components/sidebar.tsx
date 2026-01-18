"use client";

import { cn } from "@/lib/utils";
import { Package2, ChevronLeft, ChevronRight, LayoutDashboard, History } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface SidebarProps {
    className?: string;
}

export function Sidebar({ className }: SidebarProps) {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();

    const navItems = [
        { href: "/", label: "Órdenes de Compra", icon: LayoutDashboard },
        { href: "/historial", label: "Historial de Sync", icon: History },
    ];

    return (
        <aside
            className={cn(
                "flex flex-col bg-slate-900 text-white transition-all duration-300",
                collapsed ? "w-16" : "w-64",
                className
            )}
        >
            {/* Header */}
            <div className="flex h-16 items-center justify-between px-4 border-b border-slate-700">
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <Package2 className="h-6 w-6 text-blue-400" />
                        <span className="font-bold text-lg">AXAM</span>
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                    aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
                >
                    {collapsed ? (
                        <ChevronRight className="h-5 w-5" />
                    ) : (
                        <ChevronLeft className="h-5 w-5" />
                    )}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-blue-600/20 text-blue-400 border-r-2 border-blue-400"
                                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                            )}
                        >
                            <Icon className="h-5 w-5 flex-shrink-0" />
                            {!collapsed && <span>{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            {!collapsed && (
                <div className="p-4 border-t border-slate-700 text-xs text-slate-400">
                    <p>Panel de Compras</p>
                    <p className="text-slate-500">v1.0.0</p>
                </div>
            )}
        </aside>
    );
}
