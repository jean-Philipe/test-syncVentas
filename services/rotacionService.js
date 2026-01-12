/**
 * Servicio para rotar datos históricos
 * Mueve las ventas del mes actual a históricas cuando cambia el mes
 * Elimina datos históricos mayores a 12 meses
 */

const { getPrismaClient } = require('../prisma/client');
const { logInfo, logSuccess, logError, logWarning } = require('../utils/logger');
const { getYear, getMonth, subMonths, startOfMonth, endOfMonth } = require('date-fns');

const prisma = getPrismaClient();

/**
 * Obtener el mes actual en formato { ano, mes }
 */
function getMesActual() {
    const ahora = new Date();
    return {
        ano: getYear(ahora),
        mes: getMonth(ahora) + 1 // getMonth devuelve 0-11, necesitamos 1-12
    };
}

/**
 * Rotar ventas actuales a históricas
 * Se ejecuta cuando cambia el mes
 */
async function rotarVentasActualesAHistoricas() {
    try {
        const mesActual = getMesActual();
        
        logInfo(`Iniciando rotación de ventas actuales a históricas...`);
        
        // Obtener todas las ventas actuales
        const ventasActuales = await prisma.ventaActual.findMany({
            include: {
                producto: true
            }
        });
        
        if (ventasActuales.length === 0) {
            logInfo('No hay ventas actuales para rotar');
            return { rotadas: 0, eliminadas: 0 };
        }
        
        let rotadas = 0;
        let errores = 0;
        
        // Procesar en transacción para asegurar consistencia
        await prisma.$transaction(async (tx) => {
            for (const ventaActual of ventasActuales) {
                try {
                    // Intentar crear o actualizar venta histórica
                    await tx.ventaHistorica.upsert({
                        where: {
                            productoId_ano_mes: {
                                productoId: ventaActual.productoId,
                                ano: mesActual.ano,
                                mes: mesActual.mes
                            }
                        },
                        update: {
                            cantidadVendida: ventaActual.cantidadVendida,
                            montoNeto: ventaActual.montoNeto
                        },
                        create: {
                            productoId: ventaActual.productoId,
                            ano: mesActual.ano,
                            mes: mesActual.mes,
                            cantidadVendida: ventaActual.cantidadVendida,
                            montoNeto: ventaActual.montoNeto
                        }
                    });
                    
                    // Resetear venta actual (mantener stock pero resetear ventas)
                    await tx.ventaActual.update({
                        where: { productoId: ventaActual.productoId },
                        data: {
                            cantidadVendida: 0,
                            montoNeto: 0
                            // Mantener stockActual
                        }
                    });
                    
                    rotadas++;
                } catch (error) {
                    errores++;
                    logError(`Error al rotar venta del producto ${ventaActual.productoId}: ${error.message}`);
                }
            }
        });
        
        logSuccess(`Rotación completada: ${rotadas} ventas rotadas, ${errores} errores`);
        
        return { rotadas, errores };
    } catch (error) {
        logError(`Error en rotación de ventas: ${error.message}`);
        throw error;
    }
}

/**
 * Limpiar datos históricos mayores a 12 meses
 */
async function limpiarDatosAntiguos() {
    try {
        const mesActual = getMesActual();
        const fechaLimite = subMonths(new Date(mesActual.ano, mesActual.mes - 1, 1), 12);
        const anoLimite = getYear(fechaLimite);
        const mesLimite = getMonth(fechaLimite) + 1;
        
        logInfo(`Limpiando datos históricos anteriores a ${mesLimite}/${anoLimite}...`);
        
        // Eliminar ventas históricas mayores a 12 meses
        const resultadoVentas = await prisma.ventaHistorica.deleteMany({
            where: {
                OR: [
                    { ano: { lt: anoLimite } },
                    {
                        ano: anoLimite,
                        mes: { lt: mesLimite }
                    }
                ]
            }
        });
        
        // Eliminar pedidos históricos mayores a 12 meses
        const resultadoPedidos = await prisma.pedido.deleteMany({
            where: {
                OR: [
                    { ano: { lt: anoLimite } },
                    {
                        ano: anoLimite,
                        mes: { lt: mesLimite }
                    }
                ]
            }
        });
        
        logSuccess(`Limpieza completada: ${resultadoVentas.count} ventas eliminadas, ${resultadoPedidos.count} pedidos eliminados`);
        
        return {
            ventasEliminadas: resultadoVentas.count,
            pedidosEliminados: resultadoPedidos.count
        };
    } catch (error) {
        logError(`Error al limpiar datos antiguos: ${error.message}`);
        throw error;
    }
}

/**
 * Ejecutar rotación completa: rotar ventas actuales y limpiar datos antiguos
 */
async function ejecutarRotacionCompleta() {
    try {
        logInfo('=== INICIANDO ROTACIÓN COMPLETA DE DATOS ===');
        
        const rotacion = await rotarVentasActualesAHistoricas();
        const limpieza = await limpiarDatosAntiguos();
        
        logSuccess('=== ROTACIÓN COMPLETA FINALIZADA ===');
        
        return {
            rotacion,
            limpieza
        };
    } catch (error) {
        logError(`Error en rotación completa: ${error.message}`);
        throw error;
    }
}

/**
 * Verificar si es necesario rotar (si cambió el mes)
 * Retorna true si el último mes procesado es diferente al mes actual
 */
async function necesitaRotacion() {
    try {
        // Buscar la venta histórica más reciente
        const ultimaVentaHistorica = await prisma.ventaHistorica.findFirst({
            orderBy: [
                { ano: 'desc' },
                { mes: 'desc' }
            ]
        });
        
        const mesActual = getMesActual();
        
        // Si no hay ventas históricas, no necesita rotación aún
        if (!ultimaVentaHistorica) {
            return false;
        }
        
        // Si el último mes histórico es diferente al mes actual, necesita rotación
        const ultimoMesHistorico = {
            ano: ultimaVentaHistorica.ano,
            mes: ultimaVentaHistorica.mes
        };
        
        return ultimoMesHistorico.ano !== mesActual.ano || ultimoMesHistorico.mes !== mesActual.mes;
    } catch (error) {
        logError(`Error al verificar necesidad de rotación: ${error.message}`);
        return false;
    }
}

module.exports = {
    rotarVentasActualesAHistoricas,
    limpiarDatosAntiguos,
    ejecutarRotacionCompleta,
    necesitaRotacion,
    getMesActual
};
