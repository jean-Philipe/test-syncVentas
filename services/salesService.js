/**
 * Servicio para obtener ventas desde múltiples tipos de documentos del ERP Manager+
 * Tipos: FAVE (Facturas Electrónicas), BOVE (Boletas Electrónicas), NCVE (Notas de Crédito)
 * 
 * Basado en la lógica del código antiguo (gestioncompra.js)
 */

const axios = require('axios');
const { format, addDays } = require('date-fns');
const { getAuthHeaders } = require('../utils/auth');
const { logInfo, logSuccess, logError, logWarning } = require('../utils/logger');

const RUT_EMPRESA = process.env.RUT_EMPRESA;
const ERP_BASE_URL = process.env.ERP_BASE_URL;

// Tipos de documentos de venta (del código antiguo)
const DOCUMENT_TYPES = ["FAVE", "BOVE", "NCVE"];

/**
 * Obtener documentos de venta de un tipo específico para un rango de fechas
 * Usa details=1 para obtener los productos en una sola llamada (optimización clave)
 */
async function getDocumentsByType(docType, fechaInicio, fechaFin) {
    try {
        const headers = await getAuthHeaders();

        const fechaInicioStr = format(fechaInicio, 'yyyyMMdd');
        const fechaFinStr = format(fechaFin, 'yyyyMMdd');

        // Usar details=1 para obtener productos en una sola llamada (como el código antiguo)
        const url = `${ERP_BASE_URL}/documents/${RUT_EMPRESA}/${docType}/V?details=1&df=${fechaInicioStr}&dt=${fechaFinStr}`;

        const response = await axios.get(url, {
            headers,
            timeout: 120000 // 2 minutos para documentos con detalles
        });

        const documents = response.data.data || response.data || [];

        if (!Array.isArray(documents)) {
            return [];
        }

        return documents;

    } catch (error) {
        if (error.response?.status === 429) {
            const retryAfter = error.response?.data?.retry || 10;
            logWarning(`Rate limit en ${docType}, esperando ${retryAfter}s...`);
            await new Promise(resolve => setTimeout(resolve, (retryAfter + 1) * 1000));
            return getDocumentsByType(docType, fechaInicio, fechaFin); // Reintentar
        }
        logError(`Error al obtener ${docType}: ${error.message}`);
        throw error;
    }
}

/**
 * Obtener TODAS las ventas de FAVE, BOVE y NCVE para un rango de fechas
 * Combina todos los tipos de documentos en una sola respuesta
 */
async function getAllSales(fechaInicio, fechaFin) {
    logInfo(`Obteniendo ventas de ${DOCUMENT_TYPES.join(', ')} del ${format(fechaInicio, 'dd/MM/yyyy')} al ${format(fechaFin, 'dd/MM/yyyy')}...`);

    const allDocuments = [];

    // Obtener documentos de cada tipo en paralelo
    const promises = DOCUMENT_TYPES.map(async (docType) => {
        try {
            const docs = await getDocumentsByType(docType, fechaInicio, fechaFin);
            logSuccess(`  ${docType}: ${docs.length} documentos`);
            return { type: docType, documents: docs };
        } catch (error) {
            logError(`  ${docType}: Error - ${error.message}`);
            return { type: docType, documents: [], error: error.message };
        }
    });

    const results = await Promise.all(promises);

    for (const result of results) {
        // Agregar tipo de documento a cada documento para referencia
        for (const doc of result.documents) {
            doc._docType = result.type;
            allDocuments.push(doc);
        }
    }

    logSuccess(`Total: ${allDocuments.length} documentos de venta`);

    return allDocuments;
}

/**
 * Extraer productos de un documento de venta
 * Retorna array de { sku, cantidad, montoNeto }
 */
function extractProductsFromDocument(document) {
    const products = [];

    // El campo de detalles puede estar en diferentes propiedades
    const details = document.detalles || document.detalle || document.items || [];

    if (!Array.isArray(details)) {
        return products;
    }

    for (const item of details) {
        // Mapeo de campos basado en la respuesta real de la API (debugReference.js)
        const sku = item.codigo || item.cod_prod || item.codigo_prod || item.cod_art || item.sku;
        const cantidad = parseFloat(item.cantidad || item.cant || 0);

        let montoNeto = parseFloat(item.monto_neto || item.neto || item.precio_neto || 0);

        // Si no hay monto neto directo, calcularlo (precio_unitario * cantidad)
        if (montoNeto === 0 && item.precio_unitario) {
            montoNeto = parseFloat(item.precio_unitario) * cantidad;
        }

        if (sku && cantidad !== 0) {
            products.push({
                sku,
                cantidad,
                montoNeto
            });
        }
    }

    return products;
}

/**
 * Agregar ventas por SKU de una lista de documentos
 * Retorna Map<sku, { cantidad, montoNeto }>
 */
function aggregateSalesByProduct(documents) {
    const salesByProduct = new Map();

    for (const doc of documents) {
        const products = extractProductsFromDocument(doc);

        for (const product of products) {
            if (!salesByProduct.has(product.sku)) {
                salesByProduct.set(product.sku, {
                    cantidad: 0,
                    montoNeto: 0
                });
            }

            const existing = salesByProduct.get(product.sku);
            existing.cantidad += product.cantidad;
            existing.montoNeto += product.montoNeto;
        }
    }

    return salesByProduct;
}

/**
 * Obtener ventas de un día específico, agrupadas por producto
 * Optimizado para sincronización incremental diaria
 */
async function getDailySales(date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const documents = await getAllSales(startOfDay, endOfDay);
    const salesByProduct = aggregateSalesByProduct(documents);

    logInfo(`  Productos distintos: ${salesByProduct.size}`);

    return {
        date: format(date, 'yyyy-MM-dd'),
        documentsCount: documents.length,
        sales: salesByProduct
    };
}

/**
 * Obtener ventas de un mes completo, agrupadas por producto
 * Para sincronización inicial o recálculo
 */
async function getMonthlySales(year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Último día del mes

    logInfo(`Obteniendo ventas del mes ${month}/${year}...`);

    const documents = await getAllSales(startDate, endDate);
    const salesByProduct = aggregateSalesByProduct(documents);

    return {
        year,
        month,
        documentsCount: documents.length,
        sales: salesByProduct
    };
}

/**
 * Obtener stock actual de todos los productos
 */
async function getCurrentStock() {
    try {
        const headers = await getAuthHeaders();
        const today = format(new Date(), 'yyyyMMdd');

        const url = `${ERP_BASE_URL}/stock/${RUT_EMPRESA}/?dt=${today}`;

        logInfo('Obteniendo stock actual del ERP...');

        const response = await axios.get(url, {
            headers,
            timeout: 60000
        });

        const stockData = response.data.data || response.data || [];

        // Convertir a Map<sku, stock>
        const stockMap = new Map();
        for (const item of stockData) {
            const sku = item.cod_prod || item.codigo_prod;
            const stock = parseFloat(item.saldo || item.stock || 0);
            if (sku) {
                stockMap.set(sku, stock);
            }
        }

        logSuccess(`Stock obtenido para ${stockMap.size} productos`);

        return stockMap;

    } catch (error) {
        logError(`Error al obtener stock: ${error.message}`);
        throw error;
    }
}

/**
 * Obtener información de todos los productos
 */
async function getAllProducts() {
    try {
        const headers = await getAuthHeaders();

        const url = `${ERP_BASE_URL}/products/${RUT_EMPRESA}`;

        logInfo('Obteniendo catálogo de productos del ERP...');

        const response = await axios.get(url, {
            headers,
            timeout: 60000
        });

        const products = response.data.data || response.data || [];

        logSuccess(`Obtenidos ${products.length} productos del catálogo`);

        return products;

    } catch (error) {
        logError(`Error al obtener productos: ${error.message}`);
        throw error;
    }
}

module.exports = {
    DOCUMENT_TYPES,
    getDocumentsByType,
    getAllSales,
    extractProductsFromDocument,
    aggregateSalesByProduct,
    getDailySales,
    getMonthlySales,
    getCurrentStock,
    getAllProducts
};
