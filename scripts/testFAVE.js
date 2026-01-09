/**
 * Script de prueba para testear la obtención de detalles de productos de FAVEs
 * 
 * Este script prueba el endpoint con details=1 según la documentación oficial
 */

require('dotenv').config();
const axios = require('axios');
const { format } = require('date-fns');
const { getAuthHeaders } = require('../utils/auth');
const { logSection, logSuccess, logError, logWarning, logInfo } = require('../utils/logger');

const RUT_EMPRESA = process.env.RUT_EMPRESA;
const ERP_BASE_URL = process.env.ERP_BASE_URL;

/**
 * Obtener una FAVE de ejemplo
 */
async function getSampleFAVE() {
    try {
        const headers = await getAuthHeaders();
        const fechaHoy = new Date();
        const fechaInicio = new Date(fechaHoy);
        fechaInicio.setDate(fechaInicio.getDate() - 7); // Últimos 7 días
        
        const fechaInicioStr = format(fechaInicio, 'yyyyMMdd');
        const fechaFinStr = format(fechaHoy, 'yyyyMMdd');
        
        const url = `${ERP_BASE_URL}/documents/${RUT_EMPRESA}/FAVE/V/?df=${fechaInicioStr}&dt=${fechaFinStr}`;
        
        logInfo(`Obteniendo FAVEs del ${format(fechaInicio, 'dd/MM/yyyy')} al ${format(fechaHoy, 'dd/MM/yyyy')}...`);
        
        const response = await axios.get(url, { headers });
        const faves = response.data.data || response.data || [];
        
        if (!Array.isArray(faves) || faves.length === 0) {
            logError('No se encontraron FAVEs en el rango de fechas');
            return null;
        }
        
        logSuccess(`Se encontraron ${faves.length} FAVEs`);
        return faves[0]; // Retornar la primera FAVE
        
    } catch (error) {
        logError(`Error al obtener FAVEs: ${error.response?.data?.message || error.message}`);
        throw error;
    }
}

/**
 * Obtener detalles de una FAVE con details=1
 */
async function getFAVEDetails(fave) {
    const headers = await getAuthHeaders();
    const docnumreg = fave.docnumreg;
    
    // Endpoint con details=1 según documentación oficial
    const endpointConDetalles = `${ERP_BASE_URL}/documents/${RUT_EMPRESA}/FAVE/V/?docnumreg=${docnumreg}&details=1`;
    
    try {
        logInfo(`\nProbando endpoint con details=1: ${endpointConDetalles}`);
        const response = await axios.get(endpointConDetalles, { headers });
        const data = response.data.data || response.data || null;
        
        if (data) {
            // Si es un array, buscar el documento específico
            if (Array.isArray(data) && data.length > 0) {
                const documento = data.find(d => d.docnumreg === docnumreg) || data[0];
                logInfo(`✅ Respuesta recibida (array con ${data.length} elementos)`);
                return documento;
            } else {
                logInfo(`✅ Respuesta recibida (objeto único)`);
                return data;
            }
        }
        
        return null;
    } catch (error) {
        logWarning(`❌ Error: ${error.response?.status || error.message}`);
        if (error.response?.data) {
            logInfo(`   Respuesta del error:`, JSON.stringify(error.response.data, null, 2));
        }
        return null;
    }
}

/**
 * Mostrar estructura de un objeto de forma legible
 */
function mostrarEstructura(obj, nombre = 'Objeto', nivel = 0, maxNivel = 3) {
    if (nivel > maxNivel) {
        console.log('  '.repeat(nivel) + '... (profundidad máxima)');
        return;
    }
    
    if (obj === null || obj === undefined) {
        console.log('  '.repeat(nivel) + `${nombre}: null/undefined`);
        return;
    }
    
    if (Array.isArray(obj)) {
        console.log('  '.repeat(nivel) + `${nombre}: [Array] (${obj.length} elementos)`);
        if (obj.length > 0 && nivel < maxNivel) {
            console.log('  '.repeat(nivel) + '  Primer elemento:');
            mostrarEstructura(obj[0], 'Elemento[0]', nivel + 1, maxNivel);
        }
        return;
    }
    
    if (typeof obj !== 'object') {
        const valor = typeof obj === 'string' && obj.length > 100 
            ? obj.substring(0, 100) + '...' 
            : obj;
        console.log('  '.repeat(nivel) + `${nombre}: ${valor} (${typeof obj})`);
        return;
    }
    
    console.log('  '.repeat(nivel) + `${nombre}: {`);
    const keys = Object.keys(obj);
    for (const key of keys.slice(0, 20)) { // Mostrar solo los primeros 20 campos
        mostrarEstructura(obj[key], key, nivel + 1, maxNivel);
    }
    if (keys.length > 20) {
        console.log('  '.repeat(nivel + 1) + `... (${keys.length - 20} campos más)`);
    }
    console.log('  '.repeat(nivel) + '}');
}

/**
 * Función principal
 */
async function main() {
    logSection('TEST DE EXTRACCIÓN DE FAVE');
    
    try {
        // Obtener una FAVE de ejemplo
        logInfo('Obteniendo una FAVE de ejemplo...\n');
        const fave = await getSampleFAVE();
        
        if (!fave) {
            logError('No se pudo obtener una FAVE de ejemplo');
            return;
        }
        
        const folio = fave.folio || fave.numero || fave.id;
        logSuccess(`FAVE obtenida: Folio ${folio}, docnumreg: ${fave.docnumreg}\n`);
        
        // Mostrar estructura básica de la FAVE de la lista
        logSection('ESTRUCTURA DE LA FAVE (DESDE LISTA)');
        console.log('Campos principales:');
        console.log(`  - docnumreg: ${fave.docnumreg}`);
        console.log(`  - folio: ${fave.folio}`);
        console.log(`  - fecha_doc: ${fave.fecha_doc}`);
        console.log(`  - total: ${fave.total}`);
        console.log(`  - monto_afecto: ${fave.monto_afecto}`);
        console.log(`  - Tiene detalles?: ${!!(fave.detalles || fave.detalle || fave.items || fave.productos)}`);
        
        // Intentar obtener detalles con details=1
        logSection('OBTENIENDO DETALLES CON details=1');
        const faveDetails = await getFAVEDetails(fave);
        
        if (faveDetails) {
            logSection('ESTRUCTURA COMPLETA DE LA RESPUESTA');
            console.log(JSON.stringify(faveDetails, null, 2));
            
            logSection('BUSCANDO CAMPOS DE PRODUCTOS');
            const camposProductos = ['detalles', 'detalle', 'items', 'productos', 'line_items'];
            let encontrados = false;
            
            for (const campo of camposProductos) {
                if (faveDetails[campo]) {
                    logSuccess(`✅ Campo encontrado: ${campo}`);
                    console.log(`Tipo: ${Array.isArray(faveDetails[campo]) ? 'Array' : typeof faveDetails[campo]}`);
                    
                    if (Array.isArray(faveDetails[campo])) {
                        console.log(`Longitud: ${faveDetails[campo].length}`);
                        if (faveDetails[campo].length > 0) {
                            console.log('\nPrimer elemento:');
                            console.log(JSON.stringify(faveDetails[campo][0], null, 2));
                        }
                    } else {
                        console.log('\nContenido:');
                        console.log(JSON.stringify(faveDetails[campo], null, 2));
                    }
                    encontrados = true;
                }
            }
            
            if (!encontrados) {
                logWarning('⚠️  No se encontraron campos de productos en la respuesta');
                logInfo('\nTodos los campos disponibles:');
                console.log(Object.keys(faveDetails).join(', '));
            }
        } else {
            logWarning('⚠️  No se pudieron obtener detalles');
        }
        
        logSection('RESUMEN');
        logInfo('Revisa la estructura mostrada arriba para identificar:');
        logInfo('  1. Dónde están los productos/detalles');
        logInfo('  2. Qué campos contienen el SKU');
        logInfo('  3. Qué campos contienen la cantidad');
        logInfo('  4. Qué campos contienen el monto/precio');
        
    } catch (error) {
        logError(`Error en el test: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main().catch(error => {
        logError(`Error fatal: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { main, getSampleFAVE, getFAVEDetails };
