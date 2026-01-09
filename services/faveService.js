/**
 * Servicio para obtener FAVEs desde Manager+
 */

const axios = require('axios');
const { format, addDays } = require('date-fns');
const { getAuthHeaders } = require('../utils/auth');
const { logInfo, logSuccess, logError } = require('../utils/logger');

const RUT_EMPRESA = process.env.RUT_EMPRESA;
const ERP_BASE_URL = process.env.ERP_BASE_URL;

/**
 * Obtener FAVEs de un rango de fechas (máximo 1 año por consulta)
 */
async function getFAVEs(fechaInicio, fechaFin) {
    try {
        const headers = await getAuthHeaders();
        
        const fechaInicioStr = format(fechaInicio, 'yyyyMMdd');
        const fechaFinStr = format(fechaFin, 'yyyyMMdd');
        
        const url = `${ERP_BASE_URL}/documents/${RUT_EMPRESA}/FAVE/V/?df=${fechaInicioStr}&dt=${fechaFinStr}`;
        
        logInfo(`Obteniendo FAVEs del ${format(fechaInicio, 'dd/MM/yyyy')} al ${format(fechaFin, 'dd/MM/yyyy')}...`);
        
        const response = await axios.get(url, { headers });
        
        const faves = response.data.data || response.data || [];
        
        if (!Array.isArray(faves)) {
            return [];
        }
        
        return faves;
        
    } catch (error) {
        logError(`Error al obtener FAVEs: ${error.response?.data?.message || error.message}`);
        throw error;
    }
}

/**
 * Obtener todas las FAVEs dividiendo en períodos de máximo 1 año
 */
async function getAllFAVEs(fechaInicio, fechaFin) {
    const todasLasFAVEs = [];
    let fechaActual = new Date(fechaInicio);
    
    const diffTime = fechaFin.getTime() - fechaInicio.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 365) {
        logInfo(`Rango de ${diffDays} días, obteniendo FAVEs en una sola consulta...`);
        return await getFAVEs(fechaInicio, fechaFin);
    }
    
    logInfo(`Rango de ${diffDays} días excede 1 año, dividiendo en períodos de máximo 1 año...`);
    
    while (fechaActual < fechaFin) {
        let fechaFinPeriodo = new Date(fechaActual);
        fechaFinPeriodo = addDays(fechaFinPeriodo, 364);
        
        if (fechaFinPeriodo > fechaFin) {
            fechaFinPeriodo = new Date(fechaFin);
        }
        
        logInfo(`  Consultando del ${format(fechaActual, 'dd/MM/yyyy')} al ${format(fechaFinPeriodo, 'dd/MM/yyyy')}...`);
        
        const favesPeriodo = await getFAVEs(fechaActual, fechaFinPeriodo);
        todasLasFAVEs.push(...favesPeriodo);
        
        logSuccess(`    Encontradas ${favesPeriodo.length} FAVEs en este período`);
        
        fechaActual = addDays(fechaFinPeriodo, 1);
    }
    
    return todasLasFAVEs;
}

/**
 * Obtener detalles de una FAVE específica con details=1
 * Este es el método que funciona según el test
 * Incluye reintentos para manejar errores temporales
 */
async function getFAVEDetails(fave, maxRetries = 2, returnErrorInfo = false) {
    const headers = await getAuthHeaders();
    const docnumreg = fave.docnumreg;
    
    const endpointConDetalles = `${ERP_BASE_URL}/documents/${RUT_EMPRESA}/FAVE/V/?docnumreg=${docnumreg}&details=1`;
    
    let lastError = null;
    let lastResponse = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await axios.get(endpointConDetalles, { 
                headers,
                timeout: 60000 // 60 segundos de timeout (aumentado para evitar timeouts)
            });
            
            lastResponse = response.data;
            
            // Intentar obtener los datos de diferentes formas posibles
            let data = response.data;
            
            // Si response.data tiene una propiedad 'data', usarla
            if (data && data.data !== undefined) {
                data = data.data;
            }
            
            if (!data) {
                if (returnErrorInfo) {
                    return { 
                        success: false, 
                        error: 'Respuesta vacía',
                        response: lastResponse,
                        endpoint: endpointConDetalles
                    };
                }
                return null;
            }
            
            // Si es un array, buscar el documento específico
            if (Array.isArray(data)) {
                if (data.length === 0) {
                    if (returnErrorInfo) {
                        return { 
                            success: false, 
                            error: 'Array vacío en la respuesta',
                            response: lastResponse,
                            endpoint: endpointConDetalles
                        };
                    }
                    return null;
                }
                // Buscar el documento que coincida con docnumreg
                const documento = data.find(d => d && d.docnumreg === docnumreg);
                if (documento) {
                    if (returnErrorInfo) {
                        return { 
                            success: true, 
                            data: documento,
                            response: lastResponse,
                            endpoint: endpointConDetalles
                        };
                    }
                    return documento;
                }
                // Si no se encuentra, retornar el primero
                if (returnErrorInfo) {
                    return { 
                        success: true, 
                        data: data[0],
                        response: lastResponse,
                        endpoint: endpointConDetalles,
                        warning: 'Documento encontrado por posición, no por docnumreg'
                    };
                }
                return data[0];
            }
            
            // Si es un objeto único, verificar que tenga el docnumreg correcto
            if (typeof data === 'object' && data.docnumreg === docnumreg) {
                if (returnErrorInfo) {
                    return { 
                        success: true, 
                        data: data,
                        response: lastResponse,
                        endpoint: endpointConDetalles
                    };
                }
                return data;
            }
            
            // Si el docnumreg no coincide pero es un objeto, retornarlo igual
            // (puede ser que la API retorne un solo documento sin el docnumreg en la query)
            if (typeof data === 'object') {
                if (returnErrorInfo) {
                    return { 
                        success: true, 
                        data: data,
                        response: lastResponse,
                        endpoint: endpointConDetalles,
                        warning: 'Documento retornado sin verificar docnumreg'
                    };
                }
                return data;
            }
            
            if (returnErrorInfo) {
                return { 
                    success: false, 
                    error: 'Formato de datos no reconocido',
                    response: lastResponse,
                    endpoint: endpointConDetalles
                };
            }
            return null;
        } catch (error) {
            lastError = error;
            lastResponse = error.response?.data || null;
            
            // Si es error 429 (Too Many Requests), esperar el tiempo indicado
            if (error.response?.status === 429) {
                const retryAfter = error.response?.data?.retry || 7; // Segundos a esperar
                
                if (returnErrorInfo && attempt === maxRetries) {
                    return { 
                        success: false, 
                        error: error.message,
                        errorDetails: {
                            status: error.response?.status,
                            statusText: error.response?.statusText,
                            data: error.response?.data
                        },
                        response: lastResponse,
                        endpoint: endpointConDetalles
                    };
                }
                
                // Esperar el tiempo indicado antes de reintentar
                await new Promise(resolve => setTimeout(resolve, (retryAfter + 1) * 1000));
                continue; // Continuar con el siguiente intento
            }
            
            // Si es el último intento, retornar información del error si se solicita
            if (attempt === maxRetries) {
                if (returnErrorInfo) {
                    return { 
                        success: false, 
                        error: error.message,
                        errorDetails: {
                            status: error.response?.status,
                            statusText: error.response?.statusText,
                            data: error.response?.data
                        },
                        response: lastResponse,
                        endpoint: endpointConDetalles
                    };
                }
                return null;
            }
            // Esperar un poco antes de reintentar (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
    }
    
    if (returnErrorInfo) {
        return { 
            success: false, 
            error: 'Error después de todos los reintentos',
            response: lastResponse,
            endpoint: endpointConDetalles
        };
    }
    return null;
}

module.exports = {
    getFAVEs,
    getAllFAVEs,
    getFAVEDetails
};
