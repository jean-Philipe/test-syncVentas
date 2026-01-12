/**
 * Script para actualizar el stock actual de productos desde Manager+
 * 
 * Obtiene el stock de todos los productos desde Manager+ y lo sincroniza
 * con la base de datos, usando la misma lógica del proyecto de sincronización
 * con Mercado Libre.
 */

require('dotenv').config();
const { getPrismaClient } = require('../prisma/client');
const { logSection, logInfo, logSuccess, logError, logWarning, logProgress } = require('../utils/logger');
const { getAllStocks, getStocksBySKUs } = require('../services/stockService');

const prisma = getPrismaClient();

/**
 * Actualizar stock de un producto específico
 */
async function actualizarStockProducto(productoId, stockActual) {
    try {
        await prisma.ventaActual.upsert({
            where: { productoId },
            update: {
                stockActual: parseFloat(stockActual)
            },
            create: {
                productoId,
                stockActual: parseFloat(stockActual),
                cantidadVendida: 0,
                montoNeto: 0
            }
        });
        return true;
    } catch (error) {
        logError(`Error al actualizar stock del producto ${productoId}: ${error.message}`);
        return false;
    }
}

/**
 * Actualizar stock de múltiples productos
 * Recibe un objeto: { productoId: stock, ... }
 */
async function actualizarStockMasivo(stocks) {
    let actualizados = 0;
    let errores = 0;
    
    for (const [productoIdStr, stock] of Object.entries(stocks)) {
        const productoId = parseInt(productoIdStr, 10);
        if (isNaN(productoId)) {
            errores++;
            continue;
        }
        
        const exito = await actualizarStockProducto(productoId, stock);
        if (exito) {
            actualizados++;
        } else {
            errores++;
        }
    }
    
    logSuccess(`Stock actualizado: ${actualizados} productos, ${errores} errores`);
    return { actualizados, errores };
}

/**
 * Actualizar stock desde un array de objetos
 * Formato: [{ productoId: 1, stock: 10 }, ...]
 */
async function actualizarStockDesdeArray(stocksArray) {
    const stocks = {};
    stocksArray.forEach(item => {
        if (item.productoId && item.stock !== undefined) {
            stocks[item.productoId] = item.stock;
        }
    });
    
    return await actualizarStockMasivo(stocks);
}

/**
 * Ejemplo de uso: actualizar stock desde SKU
 * Formato: [{ sku: "KC43106U", stock: 10 }, ...]
 */
async function actualizarStockDesdeSKU(stocksArray) {
    let actualizados = 0;
    let errores = 0;
    
    for (const item of stocksArray) {
        try {
            const producto = await prisma.producto.findUnique({
                where: { sku: item.sku }
            });
            
            if (!producto) {
                logError(`Producto con SKU ${item.sku} no encontrado`);
                errores++;
                continue;
            }
            
            const exito = await actualizarStockProducto(producto.id, item.stock);
            if (exito) {
                actualizados++;
            } else {
                errores++;
            }
        } catch (error) {
            logError(`Error al actualizar stock de SKU ${item.sku}: ${error.message}`);
            errores++;
        }
    }
    
    logSuccess(`Stock actualizado desde SKU: ${actualizados} productos, ${errores} errores`);
    return { actualizados, errores };
}

/**
 * Sincronizar stock desde Manager+ para todos los productos
 */
async function sincronizarStockDesdeManager() {
    logSection('SINCRONIZACIÓN DE STOCK DESDE MANAGER+');
    
    try {
        // Obtener todos los stocks desde Manager+
        const stocks = await getAllStocks();
        
        logInfo(`Se obtuvieron stocks de ${Object.keys(stocks).length} productos desde Manager+`);
        
        if (Object.keys(stocks).length === 0) {
            logWarning('No se encontraron productos con stock. Verifica la conexión y credenciales.');
            return { actualizados: 0, errores: 0, noEncontrados: 0 };
        }
        
        // Obtener todos los productos de la base de datos
        const productos = await prisma.producto.findMany({
            select: {
                id: true,
                sku: true
            }
        });
        
        logInfo(`Se encontraron ${productos.length} productos en la base de datos`);
        
        // Crear mapa SKU -> productoId para búsqueda rápida
        const skuMap = {};
        productos.forEach(p => {
            skuMap[p.sku] = p.id;
        });
        
        // Actualizar stocks
        let actualizados = 0;
        let errores = 0;
        let noEncontrados = 0;
        
        logInfo('\nActualizando stocks en la base de datos...\n');
        
        for (let i = 0; i < productos.length; i++) {
            const producto = productos[i];
            const stock = stocks[producto.sku];
            
            if (stock === undefined) {
                // Producto no encontrado en Manager+ o sin stock
                noEncontrados++;
                continue;
            }
            
            try {
                await actualizarStockProducto(producto.id, stock);
                actualizados++;
            } catch (error) {
                logError(`Error al actualizar stock de ${producto.sku}: ${error.message}`);
                errores++;
            }
            
            if ((i + 1) % 100 === 0 || i === productos.length - 1) {
                logProgress(i + 1, productos.length, 'productos');
            }
        }
        
        console.log('\n');
        logSection('RESUMEN');
        logSuccess(`Total de productos procesados: ${productos.length}`);
        logInfo(`Stocks actualizados: ${actualizados}`);
        if (noEncontrados > 0) {
            logWarning(`Productos no encontrados en Manager+ o sin stock: ${noEncontrados}`);
        }
        if (errores > 0) {
            logError(`Errores al actualizar: ${errores}`);
        }
        
        return { actualizados, errores, noEncontrados };
        
    } catch (error) {
        logError(`Error en sincronización de stock: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
        throw error;
    }
}

/**
 * Sincronizar stock desde Manager+ para productos específicos por SKU
 */
async function sincronizarStockPorSKUs(skus) {
    logSection('SINCRONIZACIÓN DE STOCK POR SKU');
    
    try {
        logInfo(`Obteniendo stock de ${skus.length} productos...`);
        
        const { stocks, errors } = await getStocksBySKUs(skus);
        
        if (Object.keys(stocks).length === 0) {
            logWarning('No se encontraron productos con stock.');
            return { actualizados: 0, errores: Object.keys(errors).length };
        }
        
        let actualizados = 0;
        let errores = 0;
        
        logInfo('\nActualizando stocks en la base de datos...\n');
        
        for (const [sku, stock] of Object.entries(stocks)) {
            try {
                const producto = await prisma.producto.findUnique({
                    where: { sku }
                });
                
                if (!producto) {
                    logWarning(`Producto con SKU ${sku} no encontrado en la base de datos`);
                    errores++;
                    continue;
                }
                
                await actualizarStockProducto(producto.id, stock);
                actualizados++;
            } catch (error) {
                logError(`Error al actualizar stock de ${sku}: ${error.message}`);
                errores++;
            }
        }
        
        console.log('\n');
        logSection('RESUMEN');
        logSuccess(`Stocks actualizados: ${actualizados}`);
        if (errores > 0) {
            logError(`Errores: ${errores}`);
        }
        
        return { actualizados, errores };
        
    } catch (error) {
        logError(`Error en sincronización de stock: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
        throw error;
    }
}

/**
 * Función principal - sincroniza stock desde Manager+
 */
async function main() {
    logSection('ACTUALIZACIÓN DE STOCK');
    
    try {
        // Sincronizar stock de todos los productos desde Manager+
        await sincronizarStockDesdeManager();
        
        logSuccess('\n✅ Sincronización de stock completada\n');
        
    } catch (error) {
        logError(`Error en actualización: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main().catch(error => {
        logError(`Error fatal: ${error.message}`);
        process.exit(1);
    });
}

module.exports = {
    actualizarStockProducto,
    actualizarStockMasivo,
    actualizarStockDesdeArray,
    actualizarStockDesdeSKU,
    sincronizarStockDesdeManager,
    sincronizarStockPorSKUs
};
