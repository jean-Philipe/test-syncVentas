/**
 * Script para sincronizar productos desde Manager+ a la base de datos
 * 
 * Obtiene todos los productos de Manager+ y los guarda en la base de datos
 * con su SKU y descripción
 */

require('dotenv').config();
const axios = require('axios');
const { getAuthHeaders } = require('../utils/auth');
const { getDatabase, closeDatabase } = require('../utils/database');
const { logSection, logSuccess, logError, logWarning, logInfo, logProgress } = require('../utils/logger');

const RUT_EMPRESA = process.env.RUT_EMPRESA;
const ERP_BASE_URL = process.env.ERP_BASE_URL;

/**
 * Obtener todos los productos de Manager+
 */
async function getAllProducts() {
    try {
        logInfo('Obteniendo productos de Manager+...');
        
        const headers = await getAuthHeaders();
        const url = `${ERP_BASE_URL}/products/${RUT_EMPRESA}?con_stock=S&con_listaprecios=S&pic=1`;
        
        logInfo(`URL: ${url}`);
        
        const response = await axios.get(url, { headers });
        
        const products = response.data.data || response.data || [];
        
        if (!Array.isArray(products)) {
            if (typeof products === 'object' && products !== null) {
                return [products];
            }
            return [];
        }
        
        return products;
        
    } catch (error) {
        logError(`Error al obtener productos: ${error.response?.data?.message || error.message}`);
        if (error.response?.data) {
            console.error('Detalles:', JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    }
}

/**
 * Extraer SKU y descripción de un producto
 */
function extractProductInfo(product) {
    const sku = product.codigo_prod || 
                product.cod_producto || 
                product.codigo || 
                product.cod || 
                product.sku || 
                '';
    
    const descripcion = product.nombre || 
                       product.descripcion || 
                       product.descrip || 
                       product.desc || 
                       '';
    
    return { sku: sku.trim(), descripcion: descripcion.trim() };
}

/**
 * Guardar o actualizar producto en la base de datos
 */
function saveProduct(db, sku, descripcion) {
    if (!sku || !descripcion) {
        return false;
    }
    
    try {
        // Intentar actualizar primero
        const update = db.prepare(`
            UPDATE productos 
            SET descripcion = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE sku = ?
        `);
        
        const result = update.run(descripcion, sku);
        
        // Si no se actualizó nada, insertar
        if (result.changes === 0) {
            const insert = db.prepare(`
                INSERT INTO productos (sku, descripcion) 
                VALUES (?, ?)
            `);
            insert.run(sku, descripcion);
            return true; // Nuevo producto
        }
        
        return false; // Producto actualizado
    } catch (error) {
        logError(`Error al guardar producto ${sku}: ${error.message}`);
        return false;
    }
}

/**
 * Función principal
 */
async function main() {
    logSection('SINCRONIZACIÓN DE PRODUCTOS');
    
    const db = getDatabase();
    
    try {
        // Obtener productos de Manager+
        const products = await getAllProducts();
        logSuccess(`Se encontraron ${products.length} productos en Manager+`);
        
        if (products.length === 0) {
            logWarning('No se encontraron productos. Verifica la conexión y credenciales.');
            return;
        }
        
        // Procesar productos
        logInfo('Procesando productos...\n');
        
        let nuevos = 0;
        let actualizados = 0;
        let omitidos = 0;
        
        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            const { sku, descripcion } = extractProductInfo(product);
            
            if (!sku || !descripcion) {
                omitidos++;
                continue;
            }
            
            const esNuevo = saveProduct(db, sku, descripcion);
            if (esNuevo) {
                nuevos++;
            } else {
                actualizados++;
            }
            
            logProgress(i + 1, products.length, 'productos');
        }
        
        console.log('\n');
        logSection('RESUMEN');
        logSuccess(`Total procesados: ${products.length}`);
        logInfo(`Nuevos productos: ${nuevos}`);
        logInfo(`Productos actualizados: ${actualizados}`);
        if (omitidos > 0) {
            logWarning(`Productos omitidos (sin SKU o descripción): ${omitidos}`);
        }
        
        // Mostrar estadísticas de la BD
        const totalBD = db.prepare('SELECT COUNT(*) as count FROM productos').get();
        logInfo(`Total de productos en base de datos: ${totalBD.count}`);
        
        logSuccess('\n✅ Sincronización de productos completada\n');
        
    } catch (error) {
        logError(`Error en la sincronización: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    } finally {
        closeDatabase();
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main().catch(error => {
        logError(`Error fatal: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { main };
