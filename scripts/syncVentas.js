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
                
                // También mostrar la estructura de la FAVE original
                logError(`   FAVE original:`);
                console.error(JSON.stringify(fave, null, 2));
                
                return {
                    success: false,
                    productos: [],
                    error: 'No se pudieron obtener detalles de la FAVE'
                };
            } else if (errorInfo?.success === true) {
                // La segunda llamada tuvo éxito, usar esos datos
                logWarning(`   ⚠️  La primera llamada falló (probablemente por timeout), pero la segunda tuvo éxito. Usando datos de la segunda llamada.`);
                if (errorInfo.warning) {
                    logWarning(`   Advertencia: ${errorInfo.warning}`);
                }
                
                // Usar los datos obtenidos en la segunda llamada
                faveDetails = errorInfo.data;
                
                // NO retornar error, continuar con el procesamiento normal
                // El código continuará después de este bloque para extraer productos
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
            
            // Verificar si tiene el campo detalles
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
        // Si es el primer error, mostrar información detallada
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
    
    // Función para procesar una FAVE y mostrar el resultado
    async function processSingleFAVE(fave, index) {
        try {
            const resultado = await processFAVE(fave);
            procesadas++;
            
            // Contar estadísticas
            if (resultado.success && resultado.productos.length > 0) {
                conProductos++;
                const porcentaje = ((procesadas / faves.length) * 100).toFixed(1);
                logSuccess(`  [${procesadas}/${faves.length}] (${porcentaje}%) ✅ Folio ${folio(fave)}: ${resultado.productos.length} productos extraídos`);
            } else {
                errores++;
                const porcentaje = ((procesadas / faves.length) * 100).toFixed(1);
                logError(`  [${procesadas}/${faves.length}] (${porcentaje}%) ❌ Folio ${folio(fave)}: ${resultado.error || 'Sin productos extraídos'}`);
            }
            
            // Mostrar estadísticas acumuladas cada 50 FAVEs procesadas
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
        
        // Ordenar resultados por índice original y agregarlos
        batchResults.sort((a, b) => a.index - b.index);
        for (const { resultado } of batchResults) {
            resultados.push(resultado);
        }
        
        // Agregar un pequeño delay entre lotes para evitar rate limiting
        // (solo si no es el último lote)
        if (i + concurrency < faves.length) {
            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms entre lotes
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
    
    // Resetear el flag de primer error para cada mes
    primerErrorMostrado = false;
    
    logInfo(`  Procesando ${faves.length} FAVEs con concurrencia de 20...`);
    
    // Procesar FAVEs con concurrencia de 20 para evitar rate limiting
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
