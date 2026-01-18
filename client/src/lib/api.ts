import axios from "axios";

// En desarrollo, Next.js usa un proxy; en producción, apunta al mismo servidor
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

// Aumentar timeout a 5 minutos (300000 ms) para soportar sincronizaciones largas
export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 300000,
});

// Types
export interface ProductoInfo {
    id: number;
    sku: string;
    descripcion: string;
    familia?: string;
}

export interface MesVenta {
    label: string;
    cantidad: number;
}

export interface MesActual {
    ventaActual: number;
    stockActual: number;
}

export interface ProductoDashboard {
    producto: ProductoInfo;
    ventasMeses: MesVenta[];
    mesActual: MesActual;
    promedio: number;
    compraSugerida: number;
    compraRealizar: number | null;
}

export interface DashboardMeta {
    mesActual: string;
    columnas: string[];
    generadoEn: string;
}

export interface DashboardResponse {
    productos: ProductoDashboard[];
    meta: DashboardMeta;
}

// API Functions
export async function fetchDashboard(meses: number, marca?: string): Promise<DashboardResponse> {
    const params = new URLSearchParams({ meses: meses.toString() });
    if (marca) {
        params.append("marca", marca);
    }
    const { data } = await api.get<DashboardResponse>(`/dashboard?${params}`);
    return data;
}

export interface SaveOrderItem {
    productoId: number;
    cantidad: number;
}

export async function saveOrders(items: SaveOrderItem[]): Promise<void> {
    await api.post("/dashboard/orden", { items });
}

export async function resetOrders(): Promise<void> {
    await api.delete("/dashboard/orden/reset");
}

export async function syncProductsApi(): Promise<void> {
    await api.post("/dashboard/sync-products");
}

// Types para Historial de Sincronización
export interface SyncLog {
    id: number;
    tipo: string;
    mesTarget: number;
    anoTarget: number;
    documentos: number;
    productos: number;
    productosConVentas: number;
    mensaje: string | null;
    createdAt: string;
}

export interface SyncHistoryResponse {
    logs: SyncLog[];
    total: number;
}

export async function fetchSyncHistory(limit: number = 50): Promise<SyncHistoryResponse> {
    const { data } = await api.get<SyncHistoryResponse>(`/dashboard/sync-history?limit=${limit}`);
    return data;
}
