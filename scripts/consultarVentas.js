/**
 * Script para consultar ventas desde la base de datos
 * 
 * Permite consultar ventas por producto, mes, año, etc.
 */

require('dotenv').config();
const { getDatabase, closeDatabase } = require('../utils/database');
const { logSection, logSuccess, logError, logInfo } = require('../utils/logger');

/**
 * Consultar ventas por producto
 */
function consultarVentasPorProducto(db, sku = null) {
    let query;
    let params;
    
    if (sku) {
        query = `
            SELECT 
                p.sku,
                p.descripcion,
                vm.ano,
                vm.mes,
                vm.cantidad_vendida,
                vm.monto_neto
            FROM ventas_mensuales vm
            JOIN productos p ON vm.producto_id = p.id
            WHERE p.sku = ?
            ORDER BY vm.ano DESC, vm.mes DESC
        `;
        params = [sku];
    } else {
        query = `
            SELECT 
                p.sku,
                p.descripcion,
                vm.ano,
                vm.mes,
                vm.cantidad_vendida,
                vm.monto_neto
            FROM ventas_mensuales vm
            JOIN productos p ON vm.producto_id = p.id
            ORDER BY vm.ano DESC, vm.mes DESC, p.sku
            LIMIT 50
        `;
        params = [];
    }
    
    return db.prepare(query).all(...params);
}

/**
 * Consultar resumen de ventas por mes
 */
function consultarResumenPorMes(db, ano = null, mes = null) {
    let query;
    let params = [];
    
    if (ano && mes) {
        query = `
            SELECT 
                vm.ano,
                vm.mes,
                COUNT(DISTINCT vm.producto_id) as productos_vendidos,
                SUM(vm.cantidad_vendida) as total_cantidad,
                SUM(vm.monto_neto) as total_monto
            FROM ventas_mensuales vm
            WHERE vm.ano = ? AND vm.mes = ?
            GROUP BY vm.ano, vm.mes
        `;
        params = [ano, mes];
    } else if (ano) {
        query = `
            SELECT 
                vm.ano,
                vm.mes,
                COUNT(DISTINCT vm.producto_id) as productos_vendidos,
                SUM(vm.cantidad_vendida) as total_cantidad,
                SUM(vm.monto_neto) as total_monto
            FROM ventas_mensuales vm
            WHERE vm.ano = ?
            GROUP BY vm.ano, vm.mes
            ORDER BY vm.mes
        `;
        params = [ano];
    } else {
        query = `
            SELECT 
                vm.ano,
                vm.mes,
                COUNT(DISTINCT vm.producto_id) as productos_vendidos,
                SUM(vm.cantidad_vendida) as total_cantidad,
                SUM(vm.monto_neto) as total_monto
            FROM ventas_mensuales vm
            GROUP BY vm.ano, vm.mes
            ORDER BY vm.ano DESC, vm.mes DESC
        `;
    }
    
    return db.prepare(query).all(...params);
}

/**
 * Consultar top productos por ventas
 */
function consultarTopProductos(db, limite = 10, ano = null, mes = null) {
    let query;
    let params = [limite];
    
    if (ano && mes) {
        query = `
            SELECT 
                p.sku,
                p.descripcion,
                SUM(vm.cantidad_vendida) as total_cantidad,
                SUM(vm.monto_neto) as total_monto
            FROM ventas_mensuales vm
            JOIN productos p ON vm.producto_id = p.id
            WHERE vm.ano = ? AND vm.mes = ?
            GROUP BY p.id, p.sku, p.descripcion
            ORDER BY total_monto DESC
            LIMIT ?
        `;
        params = [ano, mes, limite];
    } else if (ano) {
        query = `
            SELECT 
                p.sku,
                p.descripcion,
                SUM(vm.cantidad_vendida) as total_cantidad,
                SUM(vm.monto_neto) as total_monto
            FROM ventas_mensuales vm
            JOIN productos p ON vm.producto_id = p.id
            WHERE vm.ano = ?
            GROUP BY p.id, p.sku, p.descripcion
            ORDER BY total_monto DESC
            LIMIT ?
        `;
        params = [ano, limite];
    } else {
        query = `
            SELECT 
                p.sku,
                p.descripcion,
                SUM(vm.cantidad_vendida) as total_cantidad,
                SUM(vm.monto_neto) as total_monto
            FROM ventas_mensuales vm
            JOIN productos p ON vm.producto_id = p.id
            GROUP BY p.id, p.sku, p.descripcion
            ORDER BY total_monto DESC
            LIMIT ?
        `;
        params = [limite];
    }
    
    return db.prepare(query).all(...params);
}

/**
 * Función principal
 */
function main() {
    logSection('CONSULTA DE VENTAS');
    
    const db = getDatabase();
    
    try {
        // Obtener argumentos de línea de comandos
        const args = process.argv.slice(2);
        const comando = args[0] || 'resumen';
        
        switch (comando) {
            case 'resumen':
                logInfo('Resumen de ventas por mes:\n');
                const resumen = consultarResumenPorMes(db);
                
                if (resumen.length === 0) {
                    logInfo('No hay datos de ventas en la base de datos.');
                    break;
                }
                
                console.log('Mes/Año    | Productos | Cantidad Total | Monto Total (CLP)');
                console.log('-'.repeat(65));
                resumen.forEach(row => {
                    const mesAno = `${String(row.mes).padStart(2, '0')}/${row.ano}`;
                    const productos = String(row.productos_vendidos).padStart(8);
                    const cantidad = String(row.total_cantidad.toFixed(2)).padStart(14);
                    const monto = row.total_monto.toLocaleString('es-CL').padStart(20);
                    console.log(`${mesAno.padEnd(10)} | ${productos} | ${cantidad} | ${monto}`);
                });
                break;
                
            case 'producto':
                const sku = args[1];
                if (!sku) {
                    logError('Debes especificar un SKU: node consultarVentas.js producto <SKU>');
                    break;
                }
                
                logInfo(`Ventas del producto ${sku}:\n`);
                const ventas = consultarVentasPorProducto(db, sku);
                
                if (ventas.length === 0) {
                    logInfo(`No se encontraron ventas para el producto ${sku}`);
                    break;
                }
                
                console.log(`Producto: ${ventas[0].descripcion} (${ventas[0].sku})\n`);
                console.log('Mes/Año    | Cantidad | Monto (CLP)');
                console.log('-'.repeat(40));
                ventas.forEach(row => {
                    const mesAno = `${String(row.mes).padStart(2, '0')}/${row.ano}`;
                    const cantidad = String(row.cantidad_vendida.toFixed(2)).padStart(9);
                    const monto = row.monto_neto.toLocaleString('es-CL').padStart(15);
                    console.log(`${mesAno.padEnd(10)} | ${cantidad} | ${monto}`);
                });
                break;
                
            case 'top':
                const limite = parseInt(args[1]) || 10;
                logInfo(`Top ${limite} productos por ventas:\n`);
                const top = consultarTopProductos(db, limite);
                
                if (top.length === 0) {
                    logInfo('No hay datos de ventas en la base de datos.');
                    break;
                }
                
                console.log('SKU        | Descripción                          | Cantidad | Monto (CLP)');
                console.log('-'.repeat(85));
                top.forEach((row, index) => {
                    const sku = (row.sku || '').substring(0, 10).padEnd(10);
                    const desc = (row.descripcion || '').substring(0, 40).padEnd(40);
                    const cantidad = String(row.total_cantidad.toFixed(2)).padStart(9);
                    const monto = row.total_monto.toLocaleString('es-CL').padStart(15);
                    console.log(`${sku} | ${desc} | ${cantidad} | ${monto}`);
                });
                break;
                
            default:
                console.log('Uso: node consultarVentas.js [comando] [opciones]');
                console.log('\nComandos disponibles:');
                console.log('  resumen                    - Resumen de ventas por mes');
                console.log('  producto <SKU>              - Ventas de un producto específico');
                console.log('  top [limite]               - Top productos por ventas (default: 10)');
                break;
        }
        
        logSuccess('\n✅ Consulta completada\n');
        
    } catch (error) {
        logError(`Error en la consulta: ${error.message}`);
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
    main();
}

module.exports = {
    consultarVentasPorProducto,
    consultarResumenPorMes,
    consultarTopProductos
};
