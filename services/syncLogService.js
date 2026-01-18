/**
 * Servicio para registrar y consultar logs de sincronización
 */

const { getPrismaClient } = require('../prisma/client');
const { logInfo } = require('../utils/logger');

const prisma = getPrismaClient();

/**
 * Registrar una sincronización en el historial
 * 
 * @param {string} tipo - Tipo de sincronización ('ventas_actuales', 'ventas_historicas', 'productos', 'stock')
 * @param {object} stats - Estadísticas de la sincronización
 * @param {number} stats.mesTarget - Mes que se actualizó (1-12)
 * @param {number} stats.anoTarget - Año que se actualizó
 * @param {number} [stats.documentos] - Cantidad de documentos procesados
 * @param {number} [stats.productos] - Cantidad de productos actualizados
 * @param {string} [mensaje] - Mensaje descriptivo opcional
 */
async function registrarSync(tipo, stats, mensaje = null) {
    try {
        const log = await prisma.syncLog.create({
            data: {
                tipo,
                mesTarget: stats.mesTarget,
                anoTarget: stats.anoTarget,
                documentos: stats.documentos || 0,
                productos: stats.productos || 0,
                mensaje
            }
        });

        logInfo(`📝 SyncLog registrado: ${tipo} para ${stats.mesTarget}/${stats.anoTarget} - ${stats.documentos || 0} docs, ${stats.productos || 0} productos`);

        return log;
    } catch (error) {
        // No fallar si el log falla - es secundario
        console.error(`Error registrando sync log: ${error.message}`);
        return null;
    }
}

/**
 * Obtener historial de sincronizaciones
 * 
 * @param {number} [limit=50] - Cantidad máxima de registros a retornar
 * @param {string} [tipo] - Filtrar por tipo de sincronización
 * @returns {Promise<Array>} - Lista de logs ordenados por fecha descendente
 */
async function getSyncLogs(limit = 50, tipo = null) {
    const where = tipo ? { tipo } : {};

    return prisma.syncLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit
    });
}

/**
 * Obtener el último log de un tipo específico
 * 
 * @param {string} tipo - Tipo de sincronización
 * @returns {Promise<object|null>}
 */
async function getUltimoSync(tipo) {
    return prisma.syncLog.findFirst({
        where: { tipo },
        orderBy: { createdAt: 'desc' }
    });
}

module.exports = {
    registrarSync,
    getSyncLogs,
    getUltimoSync
};
