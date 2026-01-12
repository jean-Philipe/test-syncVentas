/**
 * Script para migrar datos de la base de datos SQLite existente a Prisma
 * Convierte ventas_mensuales a ventas_historicas y ventas_actuales
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const { getPrismaClient } = require('../prisma/client');
const { getMesActual } = require('../services/rotacionService');
const { logInfo, logSuccess, logError, logWarning } = require('../utils/logger');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './data/ventas.db';
const prisma = getPrismaClient();

/**
 * Migrar datos de productos
 */
async function migrarProductos(db) {
    logInfo('Migrando productos...');
    
    const productos = db.prepare('SELECT * FROM productos').all();
    
    let migrados = 0;
    let errores = 0;
    
    for (const producto of productos) {
        try {
            await prisma.producto.upsert({
                where: { sku: producto.sku },
                update: {
                    descripcion: producto.descripcion
                },
                create: {
                    sku: producto.sku,
                    descripcion: producto.descripcion
                }
            });
            migrados++;
        } catch (error) {
            errores++;
            logError(`Error al migrar producto ${producto.sku}: ${error.message}`);
        }
    }
    
    logSuccess(`Productos migrados: ${migrados}, errores: ${errores}`);
    return { migrados, errores };
}

/**
 * Migrar ventas mensuales a históricas o actuales según el mes
 */
async function migrarVentas(db) {
    logInfo('Migrando ventas mensuales...');
    
    const mesActual = getMesActual();
    const ventas = db.prepare(`
        SELECT vm.*, p.sku 
        FROM ventas_mensuales vm
        JOIN productos p ON vm.producto_id = p.id
    `).all();
    
    let historicas = 0;
    let actuales = 0;
    let errores = 0;
    
    // Obtener todos los productos para mapear IDs
    const productosMap = new Map();
    const productosPrisma = await prisma.producto.findMany();
    productosPrisma.forEach(p => {
        productosMap.set(p.sku, p.id);
    });
    
    for (const venta of ventas) {
        try {
            const productoId = productosMap.get(venta.sku);
            
            if (!productoId) {
                logWarning(`Producto con SKU ${venta.sku} no encontrado, saltando venta`);
                errores++;
                continue;
            }
            
            // Determinar si es mes actual o histórico
            const esMesActual = venta.ano === mesActual.ano && venta.mes === mesActual.mes;
            
            if (esMesActual) {
                // Migrar a ventas_actuales
                await prisma.ventaActual.upsert({
                    where: { productoId },
                    update: {
                        cantidadVendida: venta.cantidad_vendida,
                        montoNeto: venta.monto_neto
                    },
                    create: {
                        productoId,
                        cantidadVendida: venta.cantidad_vendida,
                        montoNeto: venta.monto_neto,
                        stockActual: 0 // Se actualizará después
                    }
                });
                actuales++;
            } else {
                // Migrar a ventas_historicas
                await prisma.ventaHistorica.upsert({
                    where: {
                        productoId_ano_mes: {
                            productoId,
                            ano: venta.ano,
                            mes: venta.mes
                        }
                    },
                    update: {
                        cantidadVendida: venta.cantidad_vendida,
                        montoNeto: venta.monto_neto
                    },
                    create: {
                        productoId,
                        ano: venta.ano,
                        mes: venta.mes,
                        cantidadVendida: venta.cantidad_vendida,
                        montoNeto: venta.monto_neto
                    }
                });
                historicas++;
            }
        } catch (error) {
            errores++;
            logError(`Error al migrar venta: ${error.message}`);
        }
    }
    
    logSuccess(`Ventas migradas: ${historicas} históricas, ${actuales} actuales, ${errores} errores`);
    return { historicas, actuales, errores };
}

/**
 * Función principal
 */
async function main() {
    logInfo('=== INICIANDO MIGRACIÓN A PRISMA ===\n');
    
    if (!require('fs').existsSync(DB_PATH)) {
        logError(`La base de datos no existe en ${DB_PATH}`);
        logInfo('Ejecuta primero: npm run init:db');
        process.exit(1);
    }
    
    const db = new Database(DB_PATH);
    
    try {
        // Verificar que Prisma esté configurado
        await prisma.$connect();
        logSuccess('Conectado a Prisma\n');
        
        // Migrar productos
        await migrarProductos(db);
        
        // Migrar ventas
        await migrarVentas(db);
        
        logSuccess('\n=== MIGRACIÓN COMPLETADA ===');
        
    } catch (error) {
        logError(`Error en migración: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    } finally {
        db.close();
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

module.exports = { main };
