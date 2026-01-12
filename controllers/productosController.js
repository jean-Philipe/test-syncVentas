/**
 * Controlador para endpoints de productos y ventas
 * Optimizado para consultas rápidas con agregaciones SQL
 */

const { getPrismaClient } = require('../prisma/client');
const { getMesActual } = require('../services/rotacionService');
const { logError } = require('../utils/logger');
const { subMonths, getYear, getMonth } = require('date-fns');

const prisma = getPrismaClient();

/**
 * GET /api/productos/ventas-historicas
 * Consultar ventas históricas con filtros:
 * - meses: cantidad de meses hacia atrás (1-12)
 * - marca: prefijo del SKU (ej: "KC" para Kimberly Clark)
 */
async function getVentasHistoricas(req, res) {
    try {
        const { meses = 12, marca } = req.query;
        
        // Validar parámetros
        const mesesNum = parseInt(meses, 10);
        if (isNaN(mesesNum) || mesesNum < 1 || mesesNum > 12) {
            return res.status(400).json({
                error: 'El parámetro "meses" debe ser un número entre 1 y 12'
            });
        }
        
        const mesActual = getMesActual();
        // Calcular fecha de inicio: N meses anteriores al mes actual (sin incluir el mes actual)
        // Si estamos en enero y pedimos 3 meses, queremos octubre, noviembre, diciembre
        const fechaInicio = subMonths(new Date(mesActual.ano, mesActual.mes - 1, 1), mesesNum);
        const anoInicio = getYear(fechaInicio);
        const mesInicio = getMonth(fechaInicio) + 1;
        
        // Construir filtro de fecha
        // Incluir exactamente los N meses anteriores al mes actual (excluir mes actual)
        const filtroFecha = {
            AND: [
                // Debe ser anterior al mes actual
                {
                    OR: [
                        { ano: { lt: mesActual.ano } },
                        {
                            ano: mesActual.ano,
                            mes: { lt: mesActual.mes }
                        }
                    ]
                },
                // Debe ser desde el mes de inicio en adelante
                {
                    OR: [
                        { ano: { gt: anoInicio } },
                        {
                            ano: anoInicio,
                            mes: { gte: mesInicio }
                        }
                    ]
                }
            ]
        };
        
        // Construir filtro de marca (prefijo SKU)
        const filtroMarca = marca ? {
            producto: {
                sku: {
                    startsWith: marca.toUpperCase()
                }
            }
        } : {};
        
        // Consulta optimizada: obtener ventas con producto y calcular promedio
        const ventas = await prisma.ventaHistorica.findMany({
            where: {
                ...filtroFecha,
                ...filtroMarca
            },
            include: {
                producto: {
                    select: {
                        id: true,
                        sku: true,
                        descripcion: true
                    }
                }
            },
            orderBy: [
                { producto: { sku: 'asc' } },
                { ano: 'desc' },
                { mes: 'desc' }
            ]
        });
        
        // Agrupar por producto y calcular promedios
        const productosMap = new Map();
        
        for (const venta of ventas) {
            const productoId = venta.productoId;
            
            if (!productosMap.has(productoId)) {
                productosMap.set(productoId, {
                    producto: venta.producto,
                    ventas: [],
                    totalCantidad: 0,
                    totalMonto: 0,
                    mesesConVentas: 0
                });
            }
            
            const productoData = productosMap.get(productoId);
            productoData.ventas.push({
                ano: venta.ano,
                mes: venta.mes,
                cantidadVendida: venta.cantidadVendida,
                montoNeto: venta.montoNeto
            });
            productoData.totalCantidad += venta.cantidadVendida;
            productoData.totalMonto += venta.montoNeto;
            productoData.mesesConVentas++;
        }
        
        // Calcular promedios y formatear respuesta
        const resultado = Array.from(productosMap.values()).map(data => ({
            producto: data.producto,
            ventasPorMes: data.ventas,
            promedioVenta: data.mesesConVentas > 0 
                ? parseFloat((data.totalCantidad / data.mesesConVentas).toFixed(2))
                : 0,
            promedioMonto: data.mesesConVentas > 0
                ? parseFloat((data.totalMonto / data.mesesConVentas).toFixed(2))
                : 0,
            totalMeses: data.mesesConVentas
        }));
        
        res.json({
            mesesConsultados: mesesNum,
            marca: marca || null,
            totalProductos: resultado.length,
            productos: resultado
        });
        
    } catch (error) {
        logError(`Error en getVentasHistoricas: ${error.message}`);
        res.status(500).json({
            error: 'Error al obtener ventas históricas',
            message: error.message
        });
    }
}

/**
 * GET /api/productos/ventas-actuales
 * Obtener stock y ventas actuales del mes de cada producto
 */
async function getVentasActuales(req, res) {
    try {
        const { marca } = req.query;
        
        // Construir filtro de marca
        const filtroMarca = marca ? {
            producto: {
                sku: {
                    startsWith: marca.toUpperCase()
                }
            }
        } : {};
        
        const ventasActuales = await prisma.ventaActual.findMany({
            where: filtroMarca,
            include: {
                producto: {
                    select: {
                        id: true,
                        sku: true,
                        descripcion: true
                    }
                }
            },
            orderBy: {
                producto: {
                    sku: 'asc'
                }
            }
        });
        
        const resultado = ventasActuales.map(venta => ({
            producto: venta.producto,
            cantidadVendida: venta.cantidadVendida,
            stockActual: venta.stockActual,
            montoNeto: venta.montoNeto
        }));
        
        res.json({
            marca: marca || null,
            totalProductos: resultado.length,
            productos: resultado
        });
        
    } catch (error) {
        logError(`Error en getVentasActuales: ${error.message}`);
        res.status(500).json({
            error: 'Error al obtener ventas actuales',
            message: error.message
        });
    }
}

/**
 * GET /api/productos/completo
 * Obtener información completa: histórico + actual + pedidos
 * Parámetros: meses (1-12), marca (prefijo SKU)
 */
async function getProductosCompleto(req, res) {
    try {
        const { meses = 12, marca } = req.query;
        
        // Validar parámetros
        const mesesNum = parseInt(meses, 10);
        if (isNaN(mesesNum) || mesesNum < 1 || mesesNum > 12) {
            return res.status(400).json({
                error: 'El parámetro "meses" debe ser un número entre 1 y 12'
            });
        }
        
        const mesActual = getMesActual();
        // Calcular fecha de inicio: N meses anteriores al mes actual (sin incluir el mes actual)
        // Si estamos en enero y pedimos 3 meses, queremos octubre, noviembre, diciembre
        const fechaInicio = subMonths(new Date(mesActual.ano, mesActual.mes - 1, 1), mesesNum);
        const anoInicio = getYear(fechaInicio);
        const mesInicio = getMonth(fechaInicio) + 1;
        
        // Construir filtro de fecha para históricas
        // Incluir exactamente los N meses anteriores al mes actual (excluir mes actual)
        // Simplificamos el filtro para que sea más claro y correcto
        const filtroFecha = {
            AND: [
                // Debe ser anterior al mes actual
                {
                    OR: [
                        { ano: { lt: mesActual.ano } },
                        {
                            ano: mesActual.ano,
                            mes: { lt: mesActual.mes }
                        }
                    ]
                },
                // Debe ser desde el mes de inicio en adelante
                {
                    OR: [
                        { ano: { gt: anoInicio } },
                        {
                            ano: anoInicio,
                            mes: { gte: mesInicio }
                        }
                    ]
                }
            ]
        };
        
        // Construir filtro de marca
        const filtroMarca = marca ? {
            sku: {
                startsWith: marca.toUpperCase()
            }
        } : {};
        
        // Obtener todos los productos que cumplan el filtro de marca
        const productos = await prisma.producto.findMany({
            where: filtroMarca,
            include: {
                ventasHistoricas: {
                    where: filtroFecha,
                    orderBy: [
                        { ano: 'desc' },
                        { mes: 'desc' }
                    ]
                },
                ventasActuales: true,
                pedidos: {
                    where: {
                        OR: [
                            { ano: { gt: anoInicio } },
                            {
                                ano: anoInicio,
                                mes: { gte: mesInicio }
                            }
                        ]
                    },
                    orderBy: [
                        { ano: 'desc' },
                        { mes: 'desc' }
                    ]
                }
            },
            orderBy: {
                sku: 'asc'
            }
        });
        
        // Procesar y calcular promedios
        // El stock se obtiene directamente de la base de datos (actualizado periódicamente por un cron job)
        const resultado = productos.map(producto => {
            const ventasHistoricas = producto.ventasHistoricas || [];
            // ventasActuales es un array pero solo tiene un elemento (productoId es único)
            const ventaActual = (producto.ventasActuales && producto.ventasActuales.length > 0) 
                ? producto.ventasActuales[0] 
                : null;
            
            // Calcular promedio de ventas históricas
            const totalCantidad = ventasHistoricas.reduce((sum, v) => sum + v.cantidadVendida, 0);
            const totalMonto = ventasHistoricas.reduce((sum, v) => sum + v.montoNeto, 0);
            const mesesConVentas = ventasHistoricas.length;
            const promedioVenta = mesesConVentas > 0 
                ? parseFloat((totalCantidad / mesesConVentas).toFixed(2))
                : 0;
            
            // Obtener pedidos del mes actual
            const pedidoActual = producto.pedidos.find(
                p => p.ano === mesActual.ano && p.mes === mesActual.mes
            );
            
            // Obtener stock actual desde la base de datos (actualizado periódicamente por cron job)
            const stockActual = ventaActual?.stockActual || 0;
            
            return {
                producto: {
                    id: producto.id,
                    sku: producto.sku,
                    descripcion: producto.descripcion
                },
                ventasHistoricas: ventasHistoricas.map(v => ({
                    ano: v.ano,
                    mes: v.mes,
                    cantidadVendida: v.cantidadVendida,
                    montoNeto: v.montoNeto
                })),
                ventaActual: {
                    cantidadVendida: ventaActual?.cantidadVendida || 0,
                    stockActual: stockActual, // Stock desde la base de datos (actualizado cada hora)
                    montoNeto: ventaActual?.montoNeto || 0
                },
                promedioVenta: promedioVenta,
                promedioMonto: mesesConVentas > 0
                    ? parseFloat((totalMonto / mesesConVentas).toFixed(2))
                    : 0,
                pedidos: producto.pedidos.map(p => ({
                    ano: p.ano,
                    mes: p.mes,
                    cantidad: p.cantidad
                })),
                pedidoActual: pedidoActual ? pedidoActual.cantidad : null
            };
        });
        
        res.json({
            mesesConsultados: mesesNum,
            marca: marca || null,
            mesActual: mesActual,
            totalProductos: resultado.length,
            productos: resultado
        });
        
    } catch (error) {
        logError(`Error en getProductosCompleto: ${error.message}`);
        res.status(500).json({
            error: 'Error al obtener información completa',
            message: error.message
        });
    }
}

module.exports = {
    getVentasHistoricas,
    getVentasActuales,
    getProductosCompleto
};
