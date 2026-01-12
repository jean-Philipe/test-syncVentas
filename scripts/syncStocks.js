/**
 * Script para sincronizar stocks desde Manager+ y guardarlos en la base de datos
 * 
 * Este script obtiene todos los stocks desde Manager+ y los guarda en la base de datos
 * usando Prisma, con logs detallados para debugging.
 */

require('dotenv').config();
const { getPrismaClient } = require('../prisma/client');
const { logSection, logInfo, logSuccess, logError, logWarning } = require('../utils/logger');
const { syncAndSaveAllStocks, getAllStocks } = require('../services/stockService');

const prisma = getPrismaClient();

/**
 * Verificar stocks en la base de datos
 */
async function verificarStocksEnBD() {
    logSection('VERIFICACIÓN DE STOCKS EN BASE DE DATOS');
    
    try {
        const productosConStock = await prisma.ventaActual.findMany({
            where: {
                stockActual: {
                    gt: 0
                }
            },
            include: {
                producto: {
                    select: {
                        sku: true,
                        descripcion: true
                    }
                }
            },
            orderBy: {
                stockActual: 'desc'
            },
            take: 10
        });

        logInfo(`Total de productos con stock > 0: ${productosConStock.length}`);
        
        if (productosConStock.length > 0) {
            logInfo('\nTop 10 productos con stock:');
            productosConStock.forEach((va, index) => {
                logInfo(`  ${index + 1}. SKU: ${va.producto.sku}, Stock: ${va.stockActual}, Descripción: ${va.producto.descripcion}`);
            });
        } else {
            logWarning('No hay productos con stock en la base de datos');
        }

        const totalProductos = await prisma.producto.count();
        const totalVentasActuales = await prisma.ventaActual.count();
        
        logInfo(`\nTotal productos en BD: ${totalProductos}`);
        logInfo(`Total registros VentaActual: ${totalVentasActuales}`);
        
        return productosConStock.length;
        
    } catch (error) {
        logError(`Error al verificar stocks: ${error.message}`);
        throw error;
    }
}

/**
 * Función principal de sincronización
 */
async function main() {
    logSection('SINCRONIZACIÓN DE STOCKS DESDE MANAGER+');
    
    try {
        // Verificar estado inicial
        logInfo('\n📊 Estado inicial de la base de datos:');
        const stocksIniciales = await verificarStocksEnBD();
        
        // Obtener stocks desde Manager+ (solo para verificación)
        logInfo('\n📦 Obteniendo stocks desde Manager+ (verificación)...');
        const stocksResult = await getAllStocks({ includeNames: true });
        const stocks = stocksResult.stocks || stocksResult;
        const names = stocksResult.names || {};
        
        logInfo(`\n📈 Resumen de stocks obtenidos desde Manager+:`);
        logInfo(`  Total productos: ${Object.keys(stocks).length}`);
        
        const productosConStock = Object.entries(stocks).filter(([sku, stock]) => stock > 0);
        logInfo(`  Productos con stock > 0: ${productosConStock.length}`);
        
        if (productosConStock.length > 0) {
            logInfo('\n  Ejemplos de productos con stock:');
            productosConStock.slice(0, 10).forEach(([sku, stock]) => {
                const nombre = names[sku] || 'sin nombre';
                logInfo(`    - SKU: ${sku}, Stock: ${stock}, Nombre: ${nombre}`);
            });
        } else {
            logWarning('\n⚠️  No se encontraron productos con stock > 0 desde Manager+');
            logWarning('  Esto puede indicar:');
            logWarning('    1. Los productos realmente no tienen stock');
            logWarning('    2. El formato de respuesta del API ha cambiado');
            logWarning('    3. Hay un problema con la extracción de stock');
        }
        
        // Sincronizar y guardar stocks
        logInfo('\n💾 Sincronizando y guardando stocks en la base de datos...');
        const resultado = await syncAndSaveAllStocks({
            concurrency: 10,
            includeNames: true
        });
        
        logSection('RESUMEN FINAL');
        logSuccess(`✅ Sincronización completada`);
        logInfo(`  Total procesados: ${resultado.total}`);
        logInfo(`  Guardados exitosamente: ${resultado.saved}`);
        logInfo(`  Errores: ${resultado.errors}`);
        
        if (resultado.errors > 0 && resultado.details) {
            const errores = resultado.details.filter(r => !r.success);
            logWarning(`\n  Errores encontrados:`);
            errores.slice(0, 10).forEach(err => {
                logError(`    - SKU: ${err.sku}, Error: ${err.error}`);
            });
            if (errores.length > 10) {
                logWarning(`    ... y ${errores.length - 10} errores más`);
            }
        }
        
        // Verificar estado final
        logInfo('\n📊 Estado final de la base de datos:');
        const stocksFinales = await verificarStocksEnBD();
        
        const diferencia = stocksFinales - stocksIniciales;
        if (diferencia > 0) {
            logSuccess(`\n✅ Se agregaron ${diferencia} productos con stock`);
        } else if (diferencia < 0) {
            logWarning(`\n⚠️  Se redujeron ${Math.abs(diferencia)} productos con stock`);
        } else {
            logInfo(`\nℹ️  No hubo cambios en la cantidad de productos con stock`);
        }
        
        logSuccess('\n✅ Proceso completado exitosamente\n');
        
    } catch (error) {
        logError(`\n❌ Error fatal en sincronización: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
        throw error;
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
    main,
    verificarStocksEnBD
};
