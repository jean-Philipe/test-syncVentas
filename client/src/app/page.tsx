"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchDashboard, resetOrders, syncProductsApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { KPICard } from "@/components/kpi-card";
import { FiltersBar, StockStatus, calculateProductStatus } from "@/components/filters-bar";
import { ProductTable } from "@/components/product-table";
import { Pagination } from "@/components/pagination";
import { SyncModal } from "@/components/sync-modal";
import { useState, useMemo } from "react";
import { Package, TrendingUp, AlertTriangle, ShoppingCart } from "lucide-react";

export default function DashboardPage() {
  const queryClient = useQueryClient();

  // Modal state
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Filters state
  const [marca, setMarca] = useState("");
  const [meses, setMeses] = useState(3);
  const [busqueda, setBusqueda] = useState("");
  const [ocultarCero, setOcultarCero] = useState(false);
  const [estadosSeleccionados, setEstadosSeleccionados] = useState<StockStatus[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // Data fetching
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["dashboard", meses, marca],
    queryFn: () => fetchDashboard(meses, marca || undefined),
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: resetOrders,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  // Handle reset with confirmation
  const handleReset = () => {
    if (confirm("¿Estás seguro de que quieres reiniciar TODAS las compras a 0?\n\nEsta acción eliminará todas las cantidades ingresadas en 'A Comprar'.")) {
      resetMutation.mutate();
    }
  };

  // Handle manual sync
  const handleSyncProducts = () => {
    setIsSyncModalOpen(true);
  };

  // Apply local filters
  const productosFiltered = useMemo(() => {
    if (!data?.productos) return [];

    let result = data.productos;

    // Search filter
    if (busqueda.trim()) {
      const term = busqueda.toLowerCase();
      result = result.filter((p) => {
        const sku = p.producto.sku.toLowerCase();
        const desc = p.producto.descripcion.toLowerCase();
        const fam = (p.producto.familia || "").toLowerCase();
        return sku.includes(term) || desc.includes(term) || fam.includes(term);
      });
    }

    // Hide zero average
    if (ocultarCero) {
      result = result.filter((p) => (p.promedio || 0) > 0);
    }

    // Filter by status
    if (estadosSeleccionados.length > 0) {
      result = result.filter((p) => {
        const stock = p.mesActual?.stockActual || 0;
        const promedio = p.promedio || 0;
        const sugerido = p.compraSugerida || 0;
        const status = calculateProductStatus(stock, promedio, sugerido);
        return estadosSeleccionados.includes(status);
      });
    }

    return result;
  }, [data?.productos, busqueda, ocultarCero, estadosSeleccionados]);

  // Paginated products
  const { paginatedProducts, totalPages } = useMemo(() => {
    if (pageSize === -1) {
      return { paginatedProducts: productosFiltered, totalPages: 1 };
    }

    const total = Math.ceil(productosFiltered.length / pageSize);
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;

    return {
      paginatedProducts: productosFiltered.slice(start, end),
      totalPages: total || 1,
    };
  }, [productosFiltered, currentPage, pageSize]);

  // Reset to page 1 when filters change
  const handleFilterChange = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setCurrentPage(1);
  };

  // Handle page size change
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // KPI calculations
  const kpis = useMemo(() => {
    const productos = productosFiltered;
    const todosProductos = data?.productos || [];
    const totalProductos = productos.length;

    const productosConSugerencia = productos.filter((p) => (p.compraSugerida || 0) > 0).length;

    // Stock Crítico: sobre TODOS los productos (no filtrado) para siempre mostrar el total real
    const productosCriticos = todosProductos.filter((p) => {
      const stock = p.mesActual?.stockActual || 0;
      const prom = p.promedio || 0;
      const sugerido = p.compraSugerida || 0;
      // Crítico = sugerido >= 0 (no sobrestock) Y stock < 50% del promedio
      return sugerido >= 0 && prom > 0 && stock / prom < 0.5;
    }).length;

    const totalCompras = productos.reduce((sum, p) => sum + (p.compraRealizar || 0), 0);

    return {
      totalProductos,
      productosConSugerencia,
      productosCriticos,
      totalCompras,
    };
  }, [productosFiltered, data?.productos]);

  // Last update time
  const lastUpdate = data?.meta?.generadoEn
    ? new Date(data.meta.generadoEn).toLocaleTimeString("es-CL")
    : undefined;

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          lastUpdate={lastUpdate}
          isLoading={isFetching}
          onRefresh={() => refetch()}
          onReset={handleReset}
          isResetting={resetMutation.isPending}
          onSyncProducts={handleSyncProducts}
          isSyncing={isSyncModalOpen}
        />

        <main className="flex-1 overflow-auto p-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard
              title="Total Productos"
              value={kpis.totalProductos}
              icon={Package}
            />
            <KPICard
              title="Con Sugerencia"
              value={kpis.productosConSugerencia}
              subtitle="Productos a reabastecer"
              icon={TrendingUp}
              trend="neutral"
            />
            <KPICard
              title="Stock Crítico"
              value={kpis.productosCriticos}
              subtitle={kpis.productosCriticos > 0 ? "Requieren atención" : "Todo OK"}
              icon={AlertTriangle}
              trend={kpis.productosCriticos > 0 ? "down" : "neutral"}
            />
            <KPICard
              title="Compras Registradas"
              value={kpis.totalCompras.toLocaleString("es-CL")}
              subtitle="Unidades a pedir"
              icon={ShoppingCart}
              trend="neutral"
            />
          </div>

          {/* Filters */}
          <FiltersBar
            marca={marca}
            onMarcaChange={handleFilterChange(setMarca)}
            meses={meses}
            onMesesChange={handleFilterChange(setMeses)}
            busqueda={busqueda}
            onBusquedaChange={handleFilterChange(setBusqueda)}
            ocultarCero={ocultarCero}
            onOcultarCeroChange={handleFilterChange(setOcultarCero)}
            estadosSeleccionados={estadosSeleccionados}
            onEstadosChange={handleFilterChange(setEstadosSeleccionados)}
            totalProductos={data?.productos?.length || 0}
            productosVisibles={productosFiltered.length}
            className="mb-4"
          />

          {/* Pagination - Top */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={productosFiltered.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={handlePageSizeChange}
            className="mb-4"
          />

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 text-red-600">
              Error al cargar datos: {(error as Error).message}
            </div>
          ) : (
            <ProductTable
              productos={paginatedProducts}
              columnas={data?.meta?.columnas || []}
              onOrderUpdated={() => refetch()}
            />
          )}

          {/* Pagination - Bottom */}
          {!isLoading && !error && productosFiltered.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={productosFiltered.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={handlePageSizeChange}
              className="mt-4"
            />
          )}
        </main>
      </div>
      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
      />
    </div>
  );
}
