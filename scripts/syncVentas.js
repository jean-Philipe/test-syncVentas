/**
 * Script para sincronizar ventas desde FAVEs de Manager+
 * 
 * Obtiene todas las FAVEs desde el 1 de enero de 2025,
 * las agrupa por mes y año, y calcula las ventas por producto
 */

require('dotenv').config();
const { format, parse, startOfMonth, endOfMonth, getYear, getMonth, endOfDay, parseISO, subYears, isValid } = require('date-fns');
const { getDatabase, closeDatabase } = require('../utils/database');
const { logSection, logSuccess, logError, logWarning, logInfo, logProgress } = require('../utils/logger');
const { getAllFAVEs, getFAVEDetails } = require('../services/faveService');
const { extractProductosFromFAVE } = require('../services/productExtractor');
const { saveVentasMensuales } = require('../services/ventaService');

// Fecha de inicio: 1 de enero de 2025
const FECHA_INICIO = new Date(2025, 0, 1);

/**
 * Parsear fecha desde diferentes formatos posibles de Manager
 */
function parsearFecha(fechaValue) {
    if (!fechaValue) {
        return null;
    }
    
    // Si es un número (formato yyyyMMdd)
    if (typeof fechaValue === 'number') {
        const fechaStr = fechaValue.toString();
        if (fechaStr.length === 8) {
            try {
                const parsed = parse(fechaStr, 'yyyyMMdd', new Date());
                if (isValid(parsed)) {
                    return parsed;
                }
            } catch (e) {
                // Continuar con otros formatos
            }
        }
    }
    
    // Si es string, intentar diferentes formatos
    if (typeof fechaValue === 'string') {
        // Formato yyyy-MM-dd (ISO, el más común de Manager+)
        if (/^\d{4}-\d{2}-\d{2}/.test(fechaValue)) {
            try {
                const parsed = parseISO(fechaValue);
                if (isValid(parsed)) {
                    return parsed;
                }
            } catch (e) {
                // Continuar
            }
        }
        
        // Formato dd/MM/yyyy
        if (/^\d{2}\/\d{2}\/\d{4}/.test(fechaValue)) {
            try {
                const parsed = parse(fechaValue, 'dd/MM/yyyy', new Date());
                if (isValid(parsed)) {
                    return parsed;
                }
            } catch (e) {
                // Continuar
            }
        }
        
        // Formato yyyyMMdd
        if (fechaValue.length === 8 && /^\d+$/.test(fechaValue)) {
            try {
                const parsed = parse(fechaValue, 'yyyyMMdd', new Date());
                if (isValid(parsed)) {
                    return parsed;
                }
            } catch (e) {
                // Continuar
            }
        }
        
        // Como último recurso, intentar parseISO
        try {
            const parsed = parseISO(fechaValue);
            if (isValid(parsed)) {
                return parsed;
            }
        } catch (e) {
            // Continuar
        }
    }
    
    return null;
}

/**
 * Agrupar FAVEs por mes y año según su fecha de documento
 */
function agruparFAVEsPorMes(faves) {
    const favesPorMes = {};
    const fechasProblema = [];
    
    for (const fave of faves) {
        let fechaDoc = parsearFecha(fave.fecha_doc) ||
                      parsearFecha(fave.fecha_documento) ||
                      parsearFecha(fave.fecha) ||
                      parsearFecha(fave.fecha_doc_num) ||
                      parsearFecha(fave.fecha_emision);
        
        if (!fechaDoc || !isValid(fechaDoc) || isNaN(fechaDoc.getTime())) {
            if (fechasProblema.length < 5) {
                fechasProblema.push({ 
                    folio: fave.folio, 
                    docnumreg: fave.docnumreg,
                    fecha_doc: fave.fecha_doc
                });
            }
            fechaDoc = new Date();
        }
        
        const ano = getYear(fechaDoc);
        const mes = getMonth(fechaDoc) + 1;
        const clave = `${ano}-${String(mes).padStart(2, '0')}`;
        
        if (!favesPorMes[clave]) {
            favesPorMes[clave] = {
                ano,
                mes,
                faves: []
            };
        }
        
        favesPorMes[clave].faves.push(fave);
    }
    
    if (fechasProblema.length > 0) {
        logWarning(`⚠️  ${fechasProblema.length} FAVEs (de ${faves.length}) tuvieron problemas al parsear la fecha`);
    }
    
    const meses = Object.keys(favesPorMes).sort();
    logInfo(`\n   Resumen de agrupación por mes:`);
    meses.forEach(clave => {
        const grupo = favesPorMes[clave];
        logInfo(`     Mes ${grupo.mes}/${grupo.ano}: ${grupo.faves.length} FAVEs`);
    });
    
    return favesPorMes;
}

/**
 * Procesar una FAVE individual
 */
async function processFAVE(fave) {
    const folio = fave.folio || fave.numero || fave.id;
    const docnumreg = fave.docnumreg;
    
    try {
        // Obtener detalles con details=1
        const faveDetails = await getFAVEDetails(fave);
        
        if (!faveDetails) {
            return {
                success: false,
                productos: [],
                error: 'No se pudieron obtener detalles de la FAVE'
            };
        }
        
        // Extraer productos de los detalles
        const productos = extractProductosFromFAVE(faveDetails);
        
        return {
            success: productos.length > 0,
            productos,
            error: productos.length === 0 ? 'Sin productos extraídos' : null
        };
        
    } catch (error) {
        return {
            success: false,
            productos: [],
            error: error.message
        };
    }
}

/**
 * Procesar FAVEs en lotes paralelos
 */
async function processFAVEsInBatches(faves, batchSize = 50, concurrency = 10) {
    const resultados = [];
    let procesadas = 0;
    let conProductos = 0;
    let errores = 0;
    
    // Dividir en lotes
    for (let i = 0; i < faves.length; i += batchSize) {
        const batch = faves.slice(i, i + batchSize);
        
        // Procesar lotes con límite de concurrencia
        const batchPromises = [];
        for (let j = 0; j < batch.length; j += concurrency) {
            const concurrentBatch = batch.slice(j, j + concurrency);
            const promises = concurrentBatch.map(fave => processFAVE(fave));
            batchPromises.push(Promise.allSettled(promises));
        }
        
        // Esperar a que todos los lotes del batch terminen
        const batchResults = await Promise.all(batchPromises);
        
        // Aplanar resultados y contar estadísticas
        for (const batchResult of batchResults) {
            for (const result of batchResult) {
                let resultadoFinal;
                if (result.status === 'fulfilled') {
                    resultadoFinal = result.value;
                } else {
                    resultadoFinal = {
                        success: false,
                        productos: [],
                        error: result.reason?.message || 'Error desconocido'
                    };
                    errores++;
                }
                
                // Contar estadísticas
                if (resultadoFinal.success && resultadoFinal.productos.length > 0) {
                    conProductos++;
                } else {
                    errores++;
                }
                
                resultados.push(resultadoFinal);
                procesadas++;
                
                // Mostrar progreso cada 100 FAVEs procesadas
                if (procesadas % 100 === 0 || procesadas === faves.length) {
                    logProgress(procesadas, faves.length, 'FAVEs');
                    const porcentajeConProductos = procesadas > 0 ? ((conProductos/procesadas)*100).toFixed(1) : 0;
                    const porcentajeErrores = procesadas > 0 ? ((errores/procesadas)*100).toFixed(1) : 0;
                    logInfo(`     Estadísticas: ${conProductos} con productos (${porcentajeConProductos}%), ${errores} errores (${porcentajeErrores}%)`);
                }
            }
        }
    }
    
    // Mostrar resumen final
    logInfo(`\n   Resumen del procesamiento:`);
    logInfo(`     Total procesadas: ${procesadas}`);
    logInfo(`     Con productos: ${conProductos} (${((conProductos/procesadas)*100).toFixed(1)}%)`);
    logInfo(`     Errores: ${errores} (${((errores/procesadas)*100).toFixed(1)}%)`);
    
    return resultados;
}

/**
 * Procesar FAVEs de un mes específico
 */
async function processMonthFAVEs(db, faves, ano, mes) {
    if (faves.length === 0) {
        return { procesadas: 0, productos: 0, errores: 0 };
    }
    
    logInfo(`  Procesando ${faves.length} FAVEs en paralelo...`);
    
    // Procesar FAVEs en paralelo
    const resultados = await processFAVEsInBatches(faves, 50, 10);
    
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
    
    // Guardar ventas en la base de datos
    let guardadas = 0;
    
    if (Object.keys(ventasPorProducto).length > 0) {
        logInfo(`  Guardando ventas de ${Object.keys(ventasPorProducto).length} productos...`);
        
        const resultado = saveVentasMensuales(db, ventasPorProducto, ano, mes);
        guardadas = resultado.guardadas;
        
        logSuccess(`  ✅ Mes ${mes}/${ano} procesado: ${procesadas} FAVEs procesadas, ${guardadas} productos con ventas guardados`);
    } else {
        logWarning(`  ⚠️  Mes ${mes}/${ano}: No se pudieron extraer productos de las FAVEs`);
    }
    
    if (errores > 0) {
        logWarning(`  ${errores} FAVEs con errores (sin productos extraídos)`);
    }
    
    return { procesadas, productos: guardadas, errores };
}

/**
 * Función principal
 */
async function main() {
    logSection('SINCRONIZACIÓN DE VENTAS DESDE FAVEs');
    
    const db = getDatabase();
    
    try {
        const fechaHoy = new Date();
        const fechaFin = endOfDay(fechaHoy);
        
        // Calcular la fecha de inicio: máximo 1 año atrás desde hoy
        const fechaInicioReal = FECHA_INICIO < subYears(fechaHoy, 1) 
            ? subYears(fechaHoy, 1) 
            : FECHA_INICIO;
        
        logInfo(`Obteniendo todas las FAVEs desde ${format(fechaInicioReal, 'dd/MM/yyyy')} hasta ${format(fechaHoy, 'dd/MM/yyyy')}...`);
        
        // Obtener TODAS las FAVEs dividiendo en períodos de máximo 1 año
        const todasLasFAVEs = await getAllFAVEs(fechaInicioReal, fechaFin);
        
        logSuccess(`Total de FAVEs encontradas: ${todasLasFAVEs.length}\n`);
        
        if (todasLasFAVEs.length === 0) {
            logWarning('No se encontraron FAVEs en el rango de fechas especificado.');
            return;
        }
        
        // Agrupar FAVEs por mes y año
        logInfo('Agrupando FAVEs por mes y año...');
        const favesPorMes = agruparFAVEsPorMes(todasLasFAVEs);
        
        const meses = Object.keys(favesPorMes).sort();
        logInfo(`FAVEs agrupadas en ${meses.length} meses diferentes\n`);
        
        let totalFAVEs = 0;
        let totalProductos = 0;
        let totalErrores = 0;
        
        // Procesar cada mes
        for (const claveMes of meses) {
            const grupo = favesPorMes[claveMes];
            const { ano, mes, faves } = grupo;
            
            logInfo(`\nProcesando mes: ${mes}/${ano} (${faves.length} FAVEs)`);
            
            const resultado = await processMonthFAVEs(db, faves, ano, mes);
            
            totalFAVEs += resultado.procesadas;
            totalProductos += resultado.productos;
            totalErrores += resultado.errores;
        }
        
        logSection('RESUMEN FINAL');
        logSuccess(`Total de FAVEs procesadas: ${totalFAVEs}`);
        logSuccess(`Total de productos con ventas registradas: ${totalProductos}`);
        if (totalErrores > 0) {
            logWarning(`Total de errores: ${totalErrores}`);
        }
        
        // Mostrar estadísticas de la BD
        const stats = db.prepare(`
            SELECT 
                COUNT(DISTINCT producto_id) as productos,
                COUNT(*) as registros,
                SUM(cantidad_vendida) as total_cantidad,
                SUM(monto_neto) as total_monto
            FROM ventas_mensuales
        `).get();
        
        logInfo(`\nEstadísticas de la base de datos:`);
        logInfo(`  Productos con ventas: ${stats.productos}`);
        logInfo(`  Registros de ventas: ${stats.registros}`);
        logInfo(`  Cantidad total vendida: ${stats.total_cantidad || 0}`);
        logInfo(`  Monto total (CLP): ${stats.total_monto ? stats.total_monto.toLocaleString('es-CL') : 0}`);
        
        logSuccess('\n✅ Sincronización de ventas completada\n');
        
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
