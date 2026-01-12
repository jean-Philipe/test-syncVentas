/**
 * Servicio para obtener stock de productos desde Manager+ y guardarlos en la base de datos
 * 
 * Este servicio obtiene los stocks de productos desde Manager+ usando
 * la misma lógica del proyecto de sincronización con Mercado Libre,
 * y los guarda en la base de datos Prisma para mostrarlos en el frontend.
 */

require('dotenv').config();
const axios = require('axios');
const { getAuthHeaders } = require('../utils/auth');
const { logInfo, logError, logWarning } = require('../utils/logger');
const { getPrismaClient } = require('../prisma/client');

const RUT_EMPRESA = process.env.RUT_EMPRESA;
const ERP_BASE_URL = process.env.ERP_BASE_URL;
const prisma = getPrismaClient();

/**
 * Determina si un registro de stock pertenece a "Bodega General" y excluye "Bodega temporal".
 */
function isGeneralWarehouse(stockItem = {}) {
    const name = (
        stockItem.bodega ||
        stockItem.almacen ||
        stockItem.descripcion_bodega ||
        stockItem.nombre_bodega ||
        stockItem.bod ||
        ''
    ).toString().toLowerCase().trim();

    // Si no hay nombre de bodega, asumimos bodega general (evita descartar todo por falta de campo)
    if (!name) return true;

    if (name.includes('temporal')) return false;
    if (name.includes('general')) return true;

    // Fallback: incluir otras bodegas solo si no son temporales
    return !name.includes('temporal');
}

/**
 * Extraer stock de un producto desde la respuesta del endpoint de productos
 * 
 * Cuando se usa con_stock=S, el stock viene en el campo "stock" (array de arrays)
 * donde cada objeto tiene un campo "saldo" que es el stock real
 * 
 * @param {Object} product - Objeto del producto de Manager+
 * @returns {number} Stock total del producto (solo Bodega General)
 */
function extractStockFromProduct(product) {
    let stock = 0;

    // El campo stock puede venir como array de arrays o directamente array de objetos
    const stockEntries = product.stock;
    
    if (!stockEntries) {
        logWarning(`Producto sin campo stock: ${product.codigo_prod || product.cod_producto || 'sin SKU'}`);
        return 0;
    }
    
    if (!Array.isArray(stockEntries)) {
        logWarning(`Campo stock no es array para producto: ${product.codigo_prod || product.cod_producto || 'sin SKU'}, tipo: ${typeof stockEntries}`);
        return 0;
    }

    if (stockEntries.length === 0) {
        logInfo(`Producto sin registros de stock: ${product.codigo_prod || product.cod_producto || 'sin SKU'}`);
        return 0;
    }

    const processItem = (item) => {
        if (!item || typeof item !== 'object') return;
        
        const isGeneral = isGeneralWarehouse(item);
        const saldo = item.saldo || 0;
        const saldoNum = parseFloat(saldo) || 0;
        
        if (isGeneral && saldoNum > 0) {
            stock += saldoNum;
        }
    };

    stockEntries.forEach(entry => {
        if (Array.isArray(entry)) {
            entry.forEach(processItem);
        } else {
            processItem(entry);
        }
    });

    return stock;
}

/**
 * Obtener stock de un producto desde Manager+ por SKU
 * 
 * Usa el endpoint de productos con con_stock=S para obtener el stock en la misma respuesta
 * 
 * @param {string} sku - Código SKU del producto
 * @returns {Promise<Object>} Información del producto con stock
 */
async function getManagerProductBySKU(sku) {
    try {
        const headers = await getAuthHeaders();
        
        // Usar el endpoint de productos con con_stock=S para obtener el stock
        const url = `${ERP_BASE_URL}/products/${RUT_EMPRESA}/${sku}/`;
        
        const response = await axios.get(url, {
            headers,
            params: {
                con_stock: 'S'  // Incluir stock detallado por producto
            }
        });

        const productData = response.data.data || response.data;
        
        if (!productData || (Array.isArray(productData) && productData.length === 0)) {
            return null;
        }

        // Si es un array, tomar el primer elemento
        const product = Array.isArray(productData) ? productData[0] : productData;
        
        // Extraer el stock del campo "stock" (array de arrays con campo "saldo")
        const stock = extractStockFromProduct(product);
        
        return {
            sku: product.codigo_prod || product.cod_producto || product.codigo || sku,
            nombre: product.nombre || product.descripcion || product.descrip || '',
            stock: stock,
            unidad: product.unidadstock || product.unidad || '',
            precio: product.precio || product.precio_unit || 0,
            rawData: product
        };
        
    } catch (error) {
        if (error.response?.status === 404) {
            return null; // Producto no encontrado
        }
        
        // Detectar rate limiting
        if (error.response?.status === 429) {
            throw new Error(`Rate limit alcanzado en Manager+ (429). Reduce la concurrencia.`);
        }
        
        // Detectar errores de servidor (puede ser sobrecarga)
        if (error.response?.status >= 500) {
            throw new Error(`Error del servidor Manager+ (${error.response.status}). Puede estar sobrecargado.`);
        }
        
        logError(`Error al obtener stock de ${sku} de Manager+: ${error.response?.data?.message || error.message}`);
        throw error;
    }
}

/**
 * Obtener stock de múltiples productos por SKU
 * 
 * @param {string[]} skus - Array de códigos SKU
 * @param {Object} options - Opciones de procesamiento
 * @param {number} options.concurrency - Número de peticiones concurrentes (default: 5)
 * @param {number} options.delay - Delay entre lotes en ms (default: 1000)
 * @returns {Promise<Object>} Objeto con SKU como clave y stock como valor
 */
async function getStocksBySKUs(skus, options = {}) {
    const { concurrency = 5, delay = 1000 } = options;
    const stocks = {};
    const errors = {};
    
    logInfo(`Obteniendo stock de ${skus.length} productos...`);
    
    // Procesar en lotes para evitar sobrecargar el servidor
    for (let i = 0; i < skus.length; i += concurrency) {
        const batch = skus.slice(i, i + concurrency);
        
        const promises = batch.map(async (sku) => {
            try {
                const product = await getManagerProductBySKU(sku);
                if (product) {
                    stocks[sku] = product.stock;
                } else {
                    errors[sku] = 'Producto no encontrado';
                }
            } catch (error) {
                errors[sku] = error.message;
                logWarning(`Error al obtener stock de ${sku}: ${error.message}`);
            }
        });
        
        await Promise.all(promises);
        
        // Delay entre lotes para evitar rate limiting
        if (i + concurrency < skus.length) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        logInfo(`Procesados ${Math.min(i + concurrency, skus.length)}/${skus.length} productos`);
    }
    
    if (Object.keys(errors).length > 0) {
        logWarning(`Errores al obtener stock: ${Object.keys(errors).length} productos`);
    }
    
    return { stocks, errors };
}

/**
 * Obtener stock de todos los productos desde Manager+
 * 
 * Obtiene todos los productos y extrae el stock de cada uno
 * 
 * @param {Object} options - Opciones de procesamiento
 * @param {boolean} options.includeNames - Si es true, también retorna nombres de productos (default: false)
 * @returns {Promise<Object>} Objeto con SKU como clave y stock como valor, o { stocks, names } si includeNames es true
 */
async function getAllStocks(options = {}) {
    const { includeNames = false } = options;
    
    try {
        logInfo('Obteniendo todos los productos con stock de Manager+...');
        
        const headers = await getAuthHeaders();
        const url = `${ERP_BASE_URL}/products/${RUT_EMPRESA}?con_stock=S`;
        
        const response = await axios.get(url, { headers });
        
        let products = response.data.data || response.data || [];
        
        // Normalizar a array si es necesario
        if (!Array.isArray(products)) {
            if (typeof products === 'object' && products !== null) {
                products = [products];
            } else {
                products = [];
            }
        }
        
        const stocks = {};
        const names = {};
        let procesados = 0;
        
        logInfo(`Procesando stock de ${products.length} productos...`);
        
        for (const product of products) {
            const sku = product.codigo_prod || 
                       product.cod_producto || 
                       product.codigo || 
                       product.cod || 
                       product.sku || 
                       '';
            
            if (sku) {
                const trimmedSku = sku.trim();
                const stock = extractStockFromProduct(product);
                
                // Log detallado para primeros productos y productos con stock
                if (procesados < 5 || stock > 0) {
                    logInfo(`  SKU: ${trimmedSku}, Stock extraído: ${stock}, Stock raw: ${JSON.stringify(product.stock)?.substring(0, 100)}`);
                }
                
                stocks[trimmedSku] = stock;
                
                if (includeNames) {
                    const nombre = product.nombre || 
                                  product.descripcion || 
                                  product.descrip || 
                                  trimmedSku;
                    names[trimmedSku] = nombre;
                }
                
                procesados++;
            } else {
                logWarning(`Producto sin SKU válido: ${JSON.stringify(product).substring(0, 100)}`);
            }
        }
        
        const productosConStock = Object.values(stocks).filter(s => s > 0).length;
        logInfo(`Stock extraído de ${procesados} productos (${productosConStock} con stock > 0)`);
        
        if (includeNames) {
            return { stocks, names };
        }
        
        return stocks;
        
    } catch (error) {
        logError(`Error al obtener stocks: ${error.response?.data?.message || error.message}`);
        throw error;
    }
}

/**
 * Guardar o actualizar el stock de un producto en la base de datos
 * 
 * Si el producto no existe, lo crea. Si existe, actualiza su stock.
 * 
 * @param {string} sku - Código SKU del producto
 * @param {number} stock - Cantidad de stock
 * @param {string} nombre - Nombre/descripción del producto (opcional)
 * @returns {Promise<Object>} Resultado de la operación
 */
async function saveStockToDatabase(sku, stock, nombre = null) {
    try {
        const stockNum = parseFloat(stock) || 0;
        const trimmedSku = sku.trim();
        
        // Buscar o crear el producto
        const producto = await prisma.producto.upsert({
            where: { sku: trimmedSku },
            update: {
                descripcion: nombre || undefined
            },
            create: {
                sku: trimmedSku,
                descripcion: nombre || trimmedSku
            }
        });

        // Actualizar o crear el registro de venta actual con el stock
        const ventaActual = await prisma.ventaActual.upsert({
            where: { productoId: producto.id },
            update: {
                stockActual: stockNum
            },
            create: {
                productoId: producto.id,
                stockActual: stockNum,
                cantidadVendida: 0,
                montoNeto: 0
            }
        });

        // Log detallado para primeros productos guardados
        if (stockNum > 0) {
            logInfo(`  ✅ Guardado: SKU=${trimmedSku}, Stock=${stockNum}, ProductoId=${producto.id}, VentaActualId=${ventaActual.id}`);
        }

        return {
            success: true,
            sku: trimmedSku,
            productoId: producto.id,
            stock: stockNum
        };
    } catch (error) {
        logError(`Error al guardar stock de ${sku} en la base de datos: ${error.message}`);
        if (error.stack) {
            logError(`Stack trace: ${error.stack}`);
        }
        return {
            success: false,
            sku,
            error: error.message
        };
    }
}

/**
 * Guardar múltiples stocks en la base de datos
 * 
 * @param {Object} stocks - Objeto con SKU como clave y stock como valor
 * @param {Object} productNames - Objeto opcional con SKU como clave y nombre como valor
 * @param {Object} options - Opciones de procesamiento
 * @param {number} options.concurrency - Número de operaciones concurrentes (default: 10)
 * @returns {Promise<Object>} Resumen de la operación
 */
async function saveStocksToDatabase(stocks, productNames = {}, options = {}) {
    const { concurrency = 10 } = options;
    const results = {
        total: Object.keys(stocks).length,
        saved: 0,
        errors: 0,
        details: []
    };

        logInfo(`Guardando stocks de ${results.total} productos en la base de datos...`);
        logInfo(`  Concurrencia: ${concurrency}`);
        logInfo(`  Productos con nombres: ${Object.keys(productNames).length}`);

    // Procesar en lotes para evitar sobrecargar la base de datos
    const skus = Object.keys(stocks);
    const productosConStock = skus.filter(sku => (stocks[sku] || 0) > 0);
    logInfo(`  Productos con stock > 0: ${productosConStock.length}`);
    
    for (let i = 0; i < skus.length; i += concurrency) {
        const batch = skus.slice(i, i + concurrency);
        
        const promises = batch.map(async (sku) => {
            const stock = stocks[sku];
            const nombre = productNames[sku] || null;
            return await saveStockToDatabase(sku, stock, nombre);
        });
        
        const batchResults = await Promise.all(promises);
        
        batchResults.forEach(result => {
            results.details.push(result);
            if (result.success) {
                results.saved++;
            } else {
                results.errors++;
            }
        });
        
        const procesados = Math.min(i + concurrency, skus.length);
        const porcentaje = ((procesados / skus.length) * 100).toFixed(1);
        logInfo(`  Procesados ${procesados}/${skus.length} productos (${porcentaje}%) - Guardados: ${results.saved}, Errores: ${results.errors}`);
    }

    logInfo(`✅ Stock guardado: ${results.saved} productos exitosos, ${results.errors} errores`);
    return results;
}

/**
 * Obtener stocks desde Manager+ y guardarlos en la base de datos
 * 
 * Obtiene todos los productos con stock desde Manager+ y los guarda en la base de datos.
 * Si un producto no existe, lo crea automáticamente.
 * 
 * @param {Object} options - Opciones de procesamiento
 * @param {number} options.concurrency - Concurrencia para guardar en BD (default: 10)
 * @returns {Promise<Object>} Resumen de la sincronización
 */
async function syncAndSaveAllStocks(options = {}) {
    try {
        logInfo('Iniciando sincronización completa de stocks desde Manager+...');
        
        // Obtener todos los stocks desde Manager+ (con nombres si está habilitado)
        const { includeNames = true } = options;
        const result = await getAllStocks({ includeNames });
        
        const stocks = result.stocks || result;
        const productNames = result.names || {};
        
        if (Object.keys(stocks).length === 0) {
            logWarning('No se encontraron productos con stock en Manager+');
            return {
                total: 0,
                saved: 0,
                errors: 0,
                details: []
            };
        }

        logInfo(`Se obtuvieron ${Object.keys(stocks).length} productos con stock desde Manager+`);

        // Guardar stocks en la base de datos
        const saveResults = await saveStocksToDatabase(stocks, productNames, options);
        
        return saveResults;
        
    } catch (error) {
        logError(`Error en sincronización completa de stocks: ${error.message}`);
        throw error;
    }
}

/**
 * Obtener stocks de productos específicos por SKU y guardarlos en la base de datos
 * 
 * @param {string[]} skus - Array de códigos SKU
 * @param {Object} options - Opciones de procesamiento
 * @param {number} options.concurrency - Concurrencia para obtener stocks (default: 5)
 * @param {number} options.delay - Delay entre lotes en ms (default: 1000)
 * @param {number} options.saveConcurrency - Concurrencia para guardar en BD (default: 10)
 * @returns {Promise<Object>} Resumen de la sincronización
 */
async function syncAndSaveStocksBySKUs(skus, options = {}) {
    try {
        logInfo(`Sincronizando stocks de ${skus.length} productos específicos...`);
        
        // Obtener stocks desde Manager+
        const { stocks, errors } = await getStocksBySKUs(skus, {
            concurrency: options.concurrency || 5,
            delay: options.delay || 1000
        });

        if (Object.keys(stocks).length === 0) {
            logWarning('No se encontraron productos con stock');
            return {
                total: skus.length,
                saved: 0,
                errors: Object.keys(errors).length,
                details: []
            };
        }

        // Obtener nombres de productos
        const productNames = {};
        const { saveConcurrency = 10 } = options;
        
        if (options.includeNames) {
            logInfo('Obteniendo información adicional de productos...');
            const stockSkus = Object.keys(stocks);
            
            for (let i = 0; i < stockSkus.length; i += saveConcurrency) {
                const batch = stockSkus.slice(i, i + saveConcurrency);
                
                const promises = batch.map(async (sku) => {
                    try {
                        const product = await getManagerProductBySKU(sku);
                        if (product) {
                            productNames[sku] = product.nombre;
                        }
                    } catch (error) {
                        // Continuar sin nombre si hay error
                    }
                });
                
                await Promise.all(promises);
            }
        }

        // Guardar stocks en la base de datos
        const saveResults = await saveStocksToDatabase(stocks, productNames, {
            concurrency: saveConcurrency
        });

        // Agregar errores de obtención de stocks
        saveResults.errors += Object.keys(errors).length;
        
        return saveResults;
        
    } catch (error) {
        logError(`Error en sincronización de stocks por SKU: ${error.message}`);
        throw error;
    }
}

/**
 * Obtener stock de un producto por SKU y guardarlo en la base de datos
 * 
 * @param {string} sku - Código SKU del producto
 * @returns {Promise<Object>} Resultado de la operación
 */
async function syncAndSaveStockBySKU(sku) {
    try {
        const product = await getManagerProductBySKU(sku);
        
        if (!product) {
            return {
                success: false,
                sku,
                error: 'Producto no encontrado en Manager+'
            };
        }

        const result = await saveStockToDatabase(product.sku, product.stock, product.nombre);
        return result;
        
    } catch (error) {
        logError(`Error al sincronizar stock de ${sku}: ${error.message}`);
        return {
            success: false,
            sku,
            error: error.message
        };
    }
}

module.exports = {
    isGeneralWarehouse,
    extractStockFromProduct,
    getManagerProductBySKU,
    getStocksBySKUs,
    getAllStocks,
    saveStockToDatabase,
    saveStocksToDatabase,
    syncAndSaveAllStocks,
    syncAndSaveStocksBySKUs,
    syncAndSaveStockBySKU
};
