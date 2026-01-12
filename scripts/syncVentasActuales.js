/**
 * Script para sincronizar ventas del mes actual desde FAVEs de Manager+
 * 
 * Obtiene solo las FAVEs del mes actual (desde el inicio del mes hasta hoy),
 * las procesa y actualiza la tabla ventas_actuales con las cantidades vendidas.
 * 
 * Este script está diseñado para ejecutarse cada hora automáticamente.
 */

require('dotenv').config();
const { format, startOfMonth, endOfDay, getYear, getMonth } = require('date-fns');
const { getPrismaClient } = require('../prisma/client');
const { logSection, logSuccess, logError, logWarning, logInfo, logProgress } = require('../utils/logger');
const { getFAVEs } = require('../services/faveService');
const { getFAVEDetails } = require('../services/faveService');
const { extractProductosFromFAVE } = require('../services/productExtractor');

const prisma = getPrismaClient();

// Variable global para rastrear si ya mostramos el primer error
let primerErrorMostrado = false;

/**
 * Procesar una FAVE individual
 */
async function processFAVE(fave) {
    const folio = fave.folio || fave.numero || fave.id;
    const docnumreg = fave.docnumreg;
    
    try {
        // Obtener detalles con details=1
        let faveDetails = await getFAVEDetails(fave);
        
        // Si es el primer error y no se obtuvieron detalles, obtener información detallada
        if (!faveDetails && !primerErrorMostrado) {
            primerErrorMostrado = true;
            const errorInfo = await getFAVEDetails(fave, 2, true);
            
            logError(`\n❌ PRIMER ERROR DETECTADO - FAVE Folio: ${folio}, docnumreg: ${docnumreg}`);
            logError(`   Endpoint: ${errorInfo?.endpoint || 'N/A'}`);
            
            if (errorInfo?.success === false) {
                logError(`   Error: ${errorInfo?.error || 'No se pudieron obtener detalles de la FAVE'}`);
                
                if (errorInfo?.errorDetails) {
                    logError(`   Status: ${errorInfo.errorDetails.status || 'N/A'}`);
                    logError(`   Status Text: ${errorInfo.errorDetails.statusText || 'N/A'}`);
                    if (errorInfo.errorDetails.data) {
                        logError(`   Error Data: ${JSON.stringify(errorInfo.errorDetails.data, null, 2)}`);
                    }
                }
                
                if (errorInfo?.response) {
                    logError(`   Respuesta completa:`);
                    console.error(JSON.stringify(errorInfo.response, null, 2));
                }
                
                logError(`   FAVE original:`);
                console.error(JSON.stringify(fave, null, 2));
                
                return {
                    success: false,
                    productos: [],
                    error: 'No se pudieron obtener detalles de la FAVE'
                };
            } else if (errorInfo?.success === true) {
                logWarning(`   ⚠️  La primera llamada falló (probablemente por timeout), pero la segunda tuvo éxito. Usando datos de la segunda llamada.`);
                if (errorInfo.warning) {
                    logWarning(`   Advertencia: ${errorInfo.warning}`);
                }
                
                faveDetails = errorInfo.data;
            }
        }
        
        if (!faveDetails) {
            return {
                success: false,
                productos: [],
                error: 'No se pudieron obtener detalles de la FAVE'
            };
        }
        
        // Extraer productos de los detalles
        const productos = extractProductosFromFAVE(faveDetails);
        
        // Si no se extrajeron productos y es el primer error, mostrar información detallada
        if (productos.length === 0 && !primerErrorMostrado) {
            primerErrorMostrado = true;
            
            logError(`\n❌ PRIMER ERROR DETECTADO - FAVE Folio: ${folio}, docnumreg: ${docnumreg}`);
            logError(`   Error: Sin productos extraídos`);
            logError(`   Respuesta de detalles obtenida:`);
            console.error(JSON.stringify(faveDetails, null, 2));
            
            if (faveDetails.detalles) {
                logError(`   Campo 'detalles' encontrado: ${Array.isArray(faveDetails.detalles) ? `Array con ${faveDetails.detalles.length} elementos` : typeof faveDetails.detalles}`);
                if (Array.isArray(faveDetails.detalles) && faveDetails.detalles.length > 0) {
                    logError(`   Primer elemento de detalles:`);
                    console.error(JSON.stringify(faveDetails.detalles[0], null, 2));
                }
            } else {
                logError(`   Campo 'detalles' NO encontrado`);
                logError(`   Campos disponibles: ${Object.keys(faveDetails).join(', ')}`);
            }
        }
        
        return {
            success: productos.length > 0,
            productos,
            error: productos.length === 0 ? 'Sin productos extraídos' : null
        };
        
    } catch (error) {
        if (!primerErrorMostrado) {
            primerErrorMostrado = true;
            
            logError(`\n❌ PRIMER ERROR DETECTADO - FAVE Folio: ${folio}, docnumreg: ${docnumreg}`);
            logError(`   Error: ${error.message}`);
            if (error.stack) {
                logError(`   Stack trace:`);
                console.error(error.stack);
            }
            logError(`   FAVE original:`);
            console.error(JSON.stringify(fave, null, 2));
        }
        
        return {
            success: false,
            productos: [],
            error: error.message
        };
    }
}

/**
 * Procesar FAVEs con concurrencia limitada (20 a la vez) para evitar rate limiting
 */
async function processFAVEsSequentially(faves, concurrency = 20) {
    const resultados = [];
    let procesadas = 0;  
    let conProductos = 0;
    let errores = 0;
    
    const folio = (fave) => fave.folio || fave.numero || fave.id || 'N/A';
    
    async function processSingleFAVE(fave, index) {
        try {
            const resultado = await processFAVE(fave);
            procesadas++;
            
            if (resultado.success && resultado.productos.length > 0) {
                conProductos++;
                const porcentaje = ((procesadas / faves.length) * 100).toFixed(1);
                logSuccess(`  [${procesadas}/${faves.length}] (${porcentaje}%) ✅ Folio ${folio(fave)}: ${resultado.productos.length} productos extraídos`);
            } else {
                errores++;
                const porcentaje = ((procesadas / faves.length) * 100).toFixed(1);
                logError(`  [${procesadas}/${faves.length}] (${porcentaje}%) ❌ Folio ${folio(fave)}: ${resultado.error || 'Sin productos extraídos'}`);
            }
            
            if (procesadas % 50 === 0 || procesadas === faves.length) {
                const porcentajeConProductos = procesadas > 0 ? ((conProductos/procesadas)*100).toFixed(1) : 0;
                const porcentajeErrores = procesadas > 0 ? ((errores/procesadas)*100).toFixed(1) : 0;
                logInfo(`     Estadísticas acumuladas: ${conProductos} con productos (${porcentajeConProductos}%), ${errores} errores (${porcentajeErrores}%)`);
            }
            
            return { index, resultado };
            
        } catch (error) {
            errores++;
            procesadas++;
            const porcentaje = ((procesadas / faves.length) * 100).toFixed(1);
            logError(`  [${procesadas}/${faves.length}] (${porcentaje}%) ❌ Folio ${folio(fave)}: Error - ${error.message}`);
            
            return {
                index,
                resultado: {
                    success: false,
                    productos: [],
                    error: error.message
                }
            };
        }
    }
    
    // Procesar FAVEs en lotes con concurrencia limitada
    for (let i = 0; i < faves.length; i += concurrency) {
        const batch = faves.slice(i, i + concurrency);
        const batchPromises = batch.map((fave, batchIndex) => processSingleFAVE(fave, i + batchIndex));
        
        const batchResults = await Promise.all(batchPromises);
        
        batchResults.sort((a, b) => a.index - b.index);
        for (const { resultado } of batchResults) {
            resultados.push(resultado);
        }
        
        if (i + concurrency < faves.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    logInfo(`\n   Resumen del procesamiento:`);
    logInfo(`     Total procesadas: ${procesadas}`);
    logInfo(`     Con productos: ${conProductos} (${((conProductos/procesadas)*100).toFixed(1)}%)`);
    logInfo(`     Errores: ${errores} (${((errores/procesadas)*100).toFixed(1)}%)`);
    
    return resultados;
}

/**
 * Actualizar ventas actuales en la base de datos
 * Suma las cantidades vendidas (no reemplaza) para permitir múltiples ejecuciones
 */
async function actualizarVentasActuales(ventasPorProducto) {
    let actualizadas = 0;
    let noEncontrados = 0;
    let errores = 0;
    
    for (const [sku, venta] of Object.entries(ventasPorProducto)) {
        try {
            // Buscar producto por SKU
            const producto = await prisma.producto.findUnique({
                where: { sku }
            });
            
            if (!producto) {
                noEncontrados++;
                continue;
            }
            
            // Actualizar o crear venta actual
            // Sumamos las cantidades porque este script puede ejecutarse varias veces
            await prisma.ventaActual.upsert({
                where: { productoId: producto.id },
                update: {
                    cantidadVendida: {
                        increment: venta.cantidad
                    },
                    montoNeto: {
                        increment: venta.montoNeto
                    }
                },
                create: {
                    productoId: producto.id,
                    cantidadVendida: venta.cantidad,
                    montoNeto: venta.montoNeto,
                    stockActual: 0 // El stock se actualiza con el script de stock
                }
            });
            
            actualizadas++;
        } catch (error) {
            errores++;
            logError(`Error al actualizar venta actual de ${sku}: ${error.message}`);
        }
    }
    
    if (noEncontrados > 0) {
        logWarning(`  ${noEncontrados} productos no encontrados en la BD (ejecuta sync:productos primero)`);
    }
    
    return { actualizadas, noEncontrados, errores };
}

/**
 * Función principal
 */
async function main() {
    logSection('SINCRONIZACIÓN DE VENTAS ACTUALES DESDE FAVEs');
    
    try {
        const fechaHoy = new Date();
        const fechaInicio = startOfMonth(fechaHoy);
        const fechaFin = endOfDay(fechaHoy);
        
        const mesActual = {
            ano: getYear(fechaHoy),
            mes: getMonth(fechaHoy) + 1 // getMonth devuelve 0-11, necesitamos 1-12
        };
        
        logInfo(`Obteniendo FAVEs del mes actual (${mesActual.mes}/${mesActual.ano})...`);
        logInfo(`Rango: ${format(fechaInicio, 'dd/MM/yyyy')} al ${format(fechaFin, 'dd/MM/yyyy')}`);
        
        // Obtener FAVEs del mes actual
        const faves = await getFAVEs(fechaInicio, fechaFin);
        
        logSuccess(`Total de FAVEs encontradas: ${faves.length}\n`);
        
        if (faves.length === 0) {
            logWarning('No se encontraron FAVEs en el mes actual.');
            return;
        }
        
        // Resetear el flag de primer error
        primerErrorMostrado = false;
        
        logInfo(`Procesando ${faves.length} FAVEs con concurrencia de 20...`);
        
        // Procesar FAVEs con concurrencia de 20
        const resultados = await processFAVEsSequentially(faves, 20);
        
        console.log('\n');
        
        let procesadas = 0;
        let productosProcesados = 0;
        let errores = 0;
        const ventasPorProducto = {}; // SKU -> { cantidad, montoNeto }
        
        // Agregar productos a ventasPorProducto
        for (const resultado of resultados) {
            if (resultado.success && resultado.productos.length > 0) {
                for (const producto of resultado.productos) {
                    if (!ventasPorProducto[producto.sku]) {
                        ventasPorProducto[producto.sku] = {
                            cantidad: 0,
                            montoNeto: 0
                        };
                    }
                    ventasPorProducto[producto.sku].cantidad += producto.cantidad;
                    ventasPorProducto[producto.sku].montoNeto += producto.montoNeto;
                    productosProcesados++;
                }
                procesadas++;
            } else {
                errores++;
                procesadas++;
            }
        }
        
        console.log('\n');
        
        // Actualizar ventas actuales en la base de datos
        let actualizadas = 0;
        
        if (Object.keys(ventasPorProducto).length > 0) {
            logInfo(`Actualizando ventas actuales de ${Object.keys(ventasPorProducto).length} productos...`);
            
            const resultado = await actualizarVentasActuales(ventasPorProducto);
            actualizadas = resultado.actualizadas;
            
            logSuccess(`✅ Ventas actuales actualizadas: ${actualizadas} productos`);
            
            if (resultado.noEncontrados > 0) {
                logWarning(`  ${resultado.noEncontrados} productos no encontrados en la BD`);
            }
            if (resultado.errores > 0) {
                logError(`  ${resultado.errores} errores al actualizar`);
            }
        } else {
            logWarning(`⚠️  No se pudieron extraer productos de las FAVEs`);
        }
        
        if (errores > 0) {
            logWarning(`  ${errores} FAVEs con errores (sin productos extraídos)`);
        }
        
        logSection('RESUMEN FINAL');
        logSuccess(`Total de FAVEs procesadas: ${procesadas}`);
        logSuccess(`Productos con ventas actualizadas: ${actualizadas}`);
        if (errores > 0) {
            logWarning(`FAVEs con errores: ${errores}`);
        }
        
        logSuccess('\n✅ Sincronización de ventas actuales completada\n');
        
    } catch (error) {
        logError(`Error en sincronización: ${error.message}`);
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
    main
};
