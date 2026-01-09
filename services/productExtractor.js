/**
 * Servicio para extraer productos de los detalles de una FAVE
 * Usa exactamente el mismo método que funciona en el test
 */

/**
 * Extraer productos y cantidades de los detalles de una FAVE
 * Según el test, la respuesta tiene un campo "detalles" que es un array
 * Cada elemento tiene: codigo, cant, precio_unitario
 */
function extractProductosFromFAVE(faveDetails) {
    const productos = [];
    
    if (!faveDetails || typeof faveDetails !== 'object') {
        return productos;
    }
    
    // Según el test, los detalles están en el campo "detalles"
    // Intentar también otros campos por si acaso
    let detalles = faveDetails.detalles;
    
    // Si no está en "detalles", intentar otros campos comunes
    if (!detalles || !Array.isArray(detalles)) {
        detalles = faveDetails.detalle || 
                  faveDetails.items || 
                  faveDetails.productos || 
                  faveDetails.line_items || 
                  [];
    }
    
    // Si detalles no es un array, intentar convertir
    if (!Array.isArray(detalles)) {
        if (detalles && typeof detalles === 'object') {
            // Puede ser un objeto con claves numéricas
            detalles = Object.values(detalles);
        } else {
            return productos;
        }
    }
    
    // Si aún no es un array, retornar vacío
    if (!Array.isArray(detalles)) {
        return productos;
    }
    
    for (const detalle of detalles) {
        if (!detalle || typeof detalle !== 'object') {
            continue;
        }
        
        // Según el test, los campos son:
        // - codigo: SKU del producto
        // - cant: cantidad
        // - precio_unitario: precio unitario
        const sku = (detalle.codigo || 
                    detalle.codigo_prod || 
                    detalle.cod_producto || 
                    detalle.cod || 
                    detalle.sku || 
                    '').toString().trim();
        
        const cantidad = parseFloat(detalle.cant || 
                                   detalle.cantidad || 
                                   detalle.quantity || 
                                   0);
        
        const precioUnitario = parseFloat(detalle.precio_unitario || 
                                         detalle.precio_unit || 
                                         detalle.unit_price ||
                                         detalle.precio ||
                                         0);
        
        // Calcular monto neto: precio_unitario * cantidad
        let montoNeto = precioUnitario * cantidad;
        
        // Si no se puede calcular, intentar obtenerlo directamente
        if (montoNeto === 0 && (detalle.monto_neto || detalle.monto || detalle.total)) {
            montoNeto = parseFloat(detalle.monto_neto || 
                                  detalle.monto || 
                                  detalle.total || 
                                  0);
        }
        
        if (sku && cantidad > 0) {
            productos.push({
                sku: sku,
                cantidad,
                montoNeto
            });
        }
    }
    
    return productos;
}

module.exports = {
    extractProductosFromFAVE
};
