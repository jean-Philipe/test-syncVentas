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
const { logError, logInfo } = require('../utils/logger');
const { subMonths, getYear, getMonth, format } = require('date-fns');
const { getChileDate } = require('../utils/timezone');
const { getAllSales, aggregateSalesByProduct } = require('../services/salesService');

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
        // Consultamos al ERP solo lo de hoy (00:00 a Ahora)

        const today = getChileDate();
        const startOfToday = new Date(today);
        startOfToday.setHours(0, 0, 0, 0);

        const now = new Date(today); // Ahora

        logInfo(`Dashboard: Obteniendo ventas realtime de hoy ${startOfToday.toISOString()} a ${now.toISOString()}`);

        let ventasHoyMap = new Map();
        try {
            const docsHoy = await getAllSales(startOfToday, now);
            ventasHoyMap = aggregateSalesByProduct(docsHoy);
            logInfo(`Dashboard: ${docsHoy.length} docs de hoy, ${ventasHoyMap.size} productos vendidos hoy`);
        } catch (error) {
            logError(`Dashboard warning: Error obteniendo ventas live: ${error.message}`);
            // Continuamos sin ventas de hoy (fallback)
        }

        // Obtener todos los productos con sus datos base (hasta ayer)
        const productosDB = await prisma.producto.findMany({
            where: filtroMarca,
            include: {
                ventasHistoricas: {
                    where: filtroFecha,
                    orderBy: [{ ano: 'asc' }, { mes: 'asc' }]
                },
                ventasActuales: true
            },
            orderBy: { sku: 'asc' }
        });

        // Procesar y calcular datos del dashboard
        const rows = productosDB.map(producto => {
            const ventasHistoricas = producto.ventasHistoricas || [];
            const ventaActualDB = producto.ventasActuales?.[0] || null;

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

            // Calcular promedio (solo meses con ventas > 0 para evitar sesgo)
            const mesesConVentas = ventasMeses.filter(v => v.cantidad > 0);
            const totalCantidad = mesesConVentas.reduce((sum, v) => sum + v.cantidad, 0);
            const promedio = mesesConVentas.length > 0
                ? totalCantidad / mesesConVentas.length
                : 0;

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
                    ventaActual: cantidadMesActual, // Total acumulado real
                    stockActual: stockActual
                },
                compraSugerida,
                compraRealizar: compraSugerida > 0 ? compraSugerida : null
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
 * GET /api/dashboard/sync-status
 * 
 * Obtener estado de la última sincronización
 */
async function getSyncStatus(req, res) {
    try {
        // Obtener la última fecha de actualización de VentaActual
        const lastUpdate = await prisma.ventaActual.findFirst({
            orderBy: { updatedAt: 'desc' },
            select: { updatedAt: true }
        });

        // Contar registros
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

module.exports = {
    getDashboard,
    saveOrden,
    getSyncStatus
};
