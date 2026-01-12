/**
 * Servicio para guardar ventas en la base de datos
 */

const { logWarning } = require('../utils/logger');

/**
 * Obtener o crear ID de producto por SKU
 */
function getProductIdBySku(db, sku) {
    const stmt = db.prepare('SELECT id FROM productos WHERE sku = ?');
    const result = stmt.get(sku);
    return result ? result.id : null;
}

/**
 * Guardar o actualizar venta mensual
 */
function saveVentaMensual(db, productoId, ano, mes, cantidad, montoNeto) {
    try {
        // Intentar actualizar primero
        const update = db.prepare(`
            UPDATE ventas_mensuales 
            SET cantidad_vendida = cantidad_vendida + ?,
                monto_neto = monto_neto + ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE producto_id = ? AND ano = ? AND mes = ?
        `);
        
        const result = update.run(cantidad, montoNeto, productoId, ano, mes);
        
        // Si no se actualizó nada, insertar
        if (result.changes === 0) {
            const insert = db.prepare(`
                INSERT INTO ventas_mensuales (producto_id, ano, mes, cantidad_vendida, monto_neto)
                VALUES (?, ?, ?, ?, ?)
            `);
            insert.run(productoId, ano, mes, cantidad, montoNeto);
        }
    } catch (error) {
        throw new Error(`Error al guardar venta: ${error.message}`);
    }
}

/**
 * Guardar ventas de múltiples productos para un mes
 */
function saveVentasMensuales(db, ventasPorProducto, ano, mes) {
    let guardadas = 0;
    let noEncontrados = 0;
    
    for (const [sku, venta] of Object.entries(ventasPorProducto)) {
        const productoId = getProductIdBySku(db, sku);
        
        if (!productoId) {
            noEncontrados++;
            continue;
        }
        
        saveVentaMensual(
            db,
            productoId,
            ano,
            mes,
            venta.cantidad,
            venta.montoNeto
        );
        guardadas++;
    }
    
    if (noEncontrados > 0) {
        logWarning(`  ${noEncontrados} productos no encontrados en la BD (ejecuta sync:productos primero)`);
    }
    
    return { guardadas, noEncontrados };
}

module.exports = {
    getProductIdBySku,
    saveVentaMensual,
    saveVentasMensuales
};
