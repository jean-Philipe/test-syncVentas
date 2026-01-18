/**
 * Controlador del Dashboard de Compras
 * 
 * Endpoint principal que combina:
 * - Ventas históricas (últimos N meses desde DB)
 * - Ventas del mes actual (desde DB)
 * - Stock actual (desde DB, actualizado por cron)
 * - Cálculo de compra sugerida
 */

const { getPrismaClient } = require('../prisma/client');
const { getMesActual } = require('../services/rotacionService');
const { logError, logInfo, logSuccess } = require('../utils/logger');
const { subMonths, getYear, getMonth, format } = require('date-fns');
const { getChileDate } = require('../utils/timezone');
const { getAllSales, aggregateSalesByProduct } = require('../services/salesService');
const { syncYesterday, syncNewProducts, syncDaySales, syncCurrentMonthData } = require('../scripts/syncDaily');
const { subDays } = require('date-fns');
const { registrarSync, getSyncLogs } = require('../services/syncLogService');

const prisma = getPrismaClient();

/**
 * Generar array de meses para el rango solicitado
 */
function generateMonthsArray(mesesNum) {
    const today = new Date();
    const months = [];

    // Generar desde el mes más antiguo hasta el mes anterior al actual
    for (let i = mesesNum; i >= 1; i--) {
        const date = subMonths(today, i);
        months.push({
            ano: getYear(date),
            mes: getMonth(date) + 1,
            label: format(date, 'MMM yyyy').toUpperCase()
        });
    }

    return months;
}

/**
 * GET /api/dashboard
 * 
 * Endpoint principal del dashboard de compras
 * 
 * Query params:
 * - meses: 3 | 6 | 12 (período para el promedio y columnas visibles)
 * - marca: string (filtro opcional por prefijo SKU)
 */
async function getDashboard(req, res) {
    try {
        const { meses = 3, marca } = req.query;

        // Validar parámetros
        const mesesNum = parseInt(meses, 10);
        if (![3, 6, 12].includes(mesesNum)) {
            return res.status(400).json({
                error: 'El parámetro "meses" debe ser 3, 6 o 12'
            });
        }

        const mesActual = getMesActual();
        const monthsArray = generateMonthsArray(mesesNum);

        // Construir filtro de fecha para ventas históricas
        const fechaInicio = subMonths(new Date(mesActual.ano, mesActual.mes - 1, 1), mesesNum);
        const anoInicio = getYear(fechaInicio);
        const mesInicio = getMonth(fechaInicio) + 1;

        const filtroFecha = {
            AND: [
                // Anterior al mes actual
                {
                    OR: [
                        { ano: { lt: mesActual.ano } },
                        { ano: mesActual.ano, mes: { lt: mesActual.mes } }
                    ]
                },
                // Desde el mes de inicio
                {
                    OR: [
                        { ano: { gt: anoInicio } },
                        { ano: anoInicio, mes: { gte: mesInicio } }
                    ]
                }
            ]
        };

        // Filtro de marca
        const filtroMarca = marca ? {
            sku: { startsWith: marca.toUpperCase() }
        } : {};

        // ==========================================
        // OBTENER VENTAS DE HOY (LIVE GAP FILLING)
        // ==========================================
        const today = getChileDate();
        const startOfToday = new Date(today);
        startOfToday.setHours(0, 0, 0, 0);

        const now = new Date(today);

        let ventasHoyMap = new Map();
        try {
            const docsHoy = await getAllSales(startOfToday, now);
            ventasHoyMap = aggregateSalesByProduct(docsHoy);
        } catch (error) {
            logError(`Dashboard warning: Error obteniendo ventas live: ${error.message}`);
        }

        // Obtener todos los productos con sus datos base
        // INCLUIR PEDIDOS del mes actual para mostrar compraRealizar guardada
        const productosDB = await prisma.producto.findMany({
            where: filtroMarca,
            include: {
                ventasHistoricas: {
                    where: filtroFecha,
                    orderBy: [{ ano: 'asc' }, { mes: 'asc' }]
                },
                ventasActuales: true,
                pedidos: {
                    where: {
                        ano: mesActual.ano,
                        mes: mesActual.mes
                    }
                }
            },
            orderBy: { sku: 'asc' }
        });

        // Procesar y calcular datos del dashboard
        const rows = productosDB.map(producto => {
            const ventasHistoricas = producto.ventasHistoricas || [];
            const ventaActualDB = producto.ventasActuales?.[0] || null;
            const pedidoActual = producto.pedidos?.[0] || null;

            // Datos DB (hasta ayer)
            let cantidadMesActual = ventaActualDB?.cantidadVendida || 0;
            const stockActual = ventaActualDB?.stockActual || 0;

            // Sumar ventas live de HOY
            const ventaHoy = ventasHoyMap.get(producto.sku);
            if (ventaHoy) {
                cantidadMesActual += ventaHoy.cantidad;
            }

            // Crear mapa de ventas por mes
            const ventasPorMes = {};
            for (const venta of ventasHistoricas) {
                const key = `${venta.ano}-${venta.mes}`;
                ventasPorMes[key] = venta.cantidadVendida;
            }

            // Generar array de ventas para cada mes del período
            const ventasMeses = monthsArray.map(m => ({
                ano: m.ano,
                mes: m.mes,
                label: m.label,
                cantidad: ventasPorMes[`${m.ano}-${m.mes}`] || 0
            }));

            // Calcular promedio simple (dividir entre TODOS los meses del período)
            const totalCantidad = ventasMeses.reduce((sum, v) => sum + v.cantidad, 0);
            const promedio = totalCantidad / ventasMeses.length;

            // Calcular compra sugerida
            // Fórmula: Promedio - Stock - Venta del mes actual (DB + Hoy)
            const compraSugerida = Math.round(promedio - stockActual - cantidadMesActual);

            return {
                producto: {
                    id: producto.id,
                    sku: producto.sku,
                    descripcion: producto.descripcion,
                    familia: producto.familia
                },
                ventasMeses,
                promedio: parseFloat(promedio.toFixed(2)),
                mesActual: {
                    ano: mesActual.ano,
                    mes: mesActual.mes,
                    ventaActual: cantidadMesActual,
                    stockActual: stockActual
                },
                compraSugerida,
                // Mostrar compraRealizar solo si hay un pedido guardado (NO auto-completar)
                compraRealizar: pedidoActual?.cantidad ?? null
            };
        });

        res.json({
            meta: {
                mesesConsultados: mesesNum,
                marca: marca || null,
                mesActual: mesActual,
                columnas: monthsArray.map(m => m.label),
                totalProductos: rows.length,
                generadoEn: new Date().toISOString()
            },
            productos: rows
        });

    } catch (error) {
        logError(`Error en getDashboard: ${error.message}`);
        res.status(500).json({
            error: 'Error al obtener datos del dashboard',
            message: error.message
        });
    }
}

/**
 * POST /api/dashboard/orden
 * 
 * Guardar la orden de compra (las cantidades que el usuario decidió comprar)
 */
async function saveOrden(req, res) {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items)) {
            return res.status(400).json({
                error: 'Se requiere un array de items con {productoId, cantidad}'
            });
        }

        const mesActual = getMesActual();
        let saved = 0;

        for (const item of items) {
            if (!item.productoId || item.cantidad === undefined) continue;

            await prisma.pedido.upsert({
                where: {
                    productoId_ano_mes: {
                        productoId: item.productoId,
                        ano: mesActual.ano,
                        mes: mesActual.mes
                    }
                },
                update: {
                    cantidad: item.cantidad
                },
                create: {
                    productoId: item.productoId,
                    ano: mesActual.ano,
                    mes: mesActual.mes,
                    cantidad: item.cantidad
                }
            });
            saved++;
        }

        res.json({
            success: true,
            message: `${saved} productos guardados en pedido`,
            mes: mesActual
        });

    } catch (error) {
        logError(`Error en saveOrden: ${error.message}`);
        res.status(500).json({
            error: 'Error al guardar orden',
            message: error.message
        });
    }
}

/**
 * DELETE /api/dashboard/orden/reset
 * 
 * Resetear todas las órdenes de compra del mes actual (poner a 0)
 */
async function resetOrdenes(req, res) {
    try {
        const mesActual = getMesActual();

        // Eliminar todos los pedidos del mes actual
        const result = await prisma.pedido.deleteMany({
            where: {
                ano: mesActual.ano,
                mes: mesActual.mes
            }
        });

        logSuccess(`Reset: ${result.count} pedidos eliminados del mes ${mesActual.mes}/${mesActual.ano}`);

        res.json({
            success: true,
            message: `${result.count} pedidos reseteados`,
            mes: mesActual
        });

    } catch (error) {
        logError(`Error en resetOrdenes: ${error.message}`);
        res.status(500).json({
            error: 'Error al resetear órdenes',
            message: error.message
        });
    }
}

/**
 * GET /api/dashboard/sync-status
 * 
 * Obtener estado de la última sincronización
 */
async function getSyncStatus(req, res) {
    try {
        const lastUpdate = await prisma.ventaActual.findFirst({
            orderBy: { updatedAt: 'desc' },
            select: { updatedAt: true }
        });

        const stats = await prisma.$transaction([
            prisma.producto.count(),
            prisma.ventaHistorica.count(),
            prisma.ventaActual.count()
        ]);

        res.json({
            lastSync: lastUpdate?.updatedAt || null,
            stats: {
                productos: stats[0],
                ventasHistoricas: stats[1],
                ventasActuales: stats[2]
            }
        });

    } catch (error) {
        logError(`Error en getSyncStatus: ${error.message}`);
        res.status(500).json({
            error: 'Error al obtener estado de sincronización',
            message: error.message
        });
    }
}

/**
 * GET /api/dashboard/sync-history
 * 
 * Obtener historial de sincronizaciones
 */
async function getSyncHistory(req, res) {
    try {
        const { limit = 50, tipo } = req.query;
        const limitNum = parseInt(limit, 10);

        const logs = await getSyncLogs(limitNum, tipo || null);

        res.json({
            logs,
            total: logs.length
        });

    } catch (error) {
        logError(`Error en getSyncHistory: ${error.message}`);
        res.status(500).json({
            error: 'Error al obtener historial de sincronización',
            message: error.message
        });
    }
}

/**
 * GET /api/dashboard/sync-stream
 * 
 * Stream de eventos (SSE) para progreso de sincronización
 */
async function syncStream(req, res) {
    // Headers SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const mesActual = getMesActual();

    try {
        logInfo('Iniciando stream de sincronización...');
        sendEvent({ step: 'start', message: 'Conectando con Manager+...' });

        // 1. Productos
        sendEvent({ step: 'products', message: 'Buscando nuevos productos...' });
        const prodStats = await syncNewProducts();
        sendEvent({
            step: 'products_done',
            message: `Catálogo: ${prodStats.created} nuevos, ${prodStats.updated} actualizados`
        });

        // Registrar log de productos si hubo cambios
        if (prodStats.created > 0 || prodStats.updated > 0) {
            await registrarSync('productos', {
                mesTarget: mesActual.mes,
                anoTarget: mesActual.ano,
                productos: prodStats.created + prodStats.updated
            }, `${prodStats.created} nuevos, ${prodStats.updated} actualizados`);
        }

        // 2. Datos mes actual (Ventas + Stock) - incluir ventas hasta AHORA
        sendEvent({ step: 'data', message: 'Obteniendo ventas y stock del mes actual...' });
        const dataStats = await syncCurrentMonthData(true);  // true = incluir ventas hasta ahora (incluyendo hoy)
        sendEvent({
            step: 'data_done',
            message: `${dataStats.productosConVentas} productos con ventas, ${dataStats.updated} actualizados`
        });

        // Registrar log de ventas del mes actual
        // productosConVentas = productos con ventas en el mes (hasta ahora, incluyendo hoy)
        await registrarSync('ventas_actuales', {
            mesTarget: mesActual.mes,
            anoTarget: mesActual.ano,
            productos: dataStats.updated || 0,
            productosConVentas: dataStats.productosConVentas || 0  // Productos con ventas del mes
        }, `Sincronización manual desde dashboard`);

        sendEvent({ step: 'complete', message: '¡Sincronización finalizada!' });
        res.end();

    } catch (error) {
        logError(`Error en stream: ${error.message}`);
        sendEvent({ step: 'error', message: `Error: ${error.message}` });
        res.end();
    }
}

module.exports = {
    getDashboard,
    saveOrden,
    resetOrdenes,
    getSyncStatus,
    getSyncHistory,
    syncStream
};
