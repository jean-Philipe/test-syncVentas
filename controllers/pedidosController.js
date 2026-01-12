/**
 * Controlador para endpoints de pedidos
 */

const { getPrismaClient } = require('../prisma/client');
const { getMesActual } = require('../services/rotacionService');
const { logError } = require('../utils/logger');

const prisma = getPrismaClient();

/**
 * GET /api/pedidos
 * Obtener todos los pedidos con filtros opcionales
 */
async function getPedidos(req, res) {
    try {
        const { productoId, ano, mes, marca } = req.query;
        
        const filtros = {};
        
        if (productoId) {
            filtros.productoId = parseInt(productoId, 10);
        }
        
        if (ano) {
            filtros.ano = parseInt(ano, 10);
        }
        
        if (mes) {
            filtros.mes = parseInt(mes, 10);
        }
        
        if (marca) {
            filtros.producto = {
                sku: {
                    startsWith: marca.toUpperCase()
                }
            };
        }
        
        const pedidos = await prisma.pedido.findMany({
            where: filtros,
            include: {
                producto: {
                    select: {
                        id: true,
                        sku: true,
                        descripcion: true
                    }
                }
            },
            orderBy: [
                { ano: 'desc' },
                { mes: 'desc' },
                { producto: { sku: 'asc' } }
            ]
        });
        
        res.json({
            total: pedidos.length,
            pedidos: pedidos.map(p => ({
                id: p.id,
                producto: p.producto,
                ano: p.ano,
                mes: p.mes,
                cantidad: p.cantidad,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt
            }))
        });
        
    } catch (error) {
        logError(`Error en getPedidos: ${error.message}`);
        res.status(500).json({
            error: 'Error al obtener pedidos',
            message: error.message
        });
    }
}

/**
 * GET /api/pedidos/:productoId
 * Obtener pedidos de un producto específico
 */
async function getPedidosPorProducto(req, res) {
    try {
        const productoId = parseInt(req.params.productoId, 10);
        
        if (isNaN(productoId)) {
            return res.status(400).json({
                error: 'ID de producto inválido'
            });
        }
        
        // Verificar que el producto existe
        const producto = await prisma.producto.findUnique({
            where: { id: productoId },
            select: { id: true, sku: true, descripcion: true }
        });
        
        if (!producto) {
            return res.status(404).json({
                error: 'Producto no encontrado'
            });
        }
        
        const pedidos = await prisma.pedido.findMany({
            where: { productoId },
            orderBy: [
                { ano: 'desc' },
                { mes: 'desc' }
            ]
        });
        
        res.json({
            producto,
            total: pedidos.length,
            pedidos: pedidos.map(p => ({
                id: p.id,
                ano: p.ano,
                mes: p.mes,
                cantidad: p.cantidad,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt
            }))
        });
        
    } catch (error) {
        logError(`Error en getPedidosPorProducto: ${error.message}`);
        res.status(500).json({
            error: 'Error al obtener pedidos del producto',
            message: error.message
        });
    }
}

/**
 * PUT /api/pedidos/:productoId
 * Crear o actualizar pedido para un producto en un mes específico
 * Body: { ano, mes, cantidad }
 */
async function upsertPedido(req, res) {
    try {
        const productoId = parseInt(req.params.productoId, 10);
        const { ano, mes, cantidad } = req.body;
        
        // Validaciones
        if (isNaN(productoId)) {
            return res.status(400).json({
                error: 'ID de producto inválido'
            });
        }
        
        if (!ano || !mes) {
            return res.status(400).json({
                error: 'Se requiere "ano" y "mes" en el body'
            });
        }
        
        const anoNum = parseInt(ano, 10);
        const mesNum = parseInt(mes, 10);
        const cantidadNum = parseFloat(cantidad) || 0;
        
        if (isNaN(anoNum) || isNaN(mesNum)) {
            return res.status(400).json({
                error: 'Año y mes deben ser números válidos'
            });
        }
        
        if (mesNum < 1 || mesNum > 12) {
            return res.status(400).json({
                error: 'El mes debe estar entre 1 y 12'
            });
        }
        
        // Verificar que el producto existe
        const producto = await prisma.producto.findUnique({
            where: { id: productoId },
            select: { id: true, sku: true, descripcion: true }
        });
        
        if (!producto) {
            return res.status(404).json({
                error: 'Producto no encontrado'
            });
        }
        
        // Crear o actualizar pedido
        const pedido = await prisma.pedido.upsert({
            where: {
                productoId_ano_mes: {
                    productoId,
                    ano: anoNum,
                    mes: mesNum
                }
            },
            update: {
                cantidad: cantidadNum
            },
            create: {
                productoId,
                ano: anoNum,
                mes: mesNum,
                cantidad: cantidadNum
            },
            include: {
                producto: {
                    select: {
                        id: true,
                        sku: true,
                        descripcion: true
                    }
                }
            }
        });
        
        res.json({
            message: 'Pedido guardado exitosamente',
            pedido: {
                id: pedido.id,
                producto: pedido.producto,
                ano: pedido.ano,
                mes: pedido.mes,
                cantidad: pedido.cantidad,
                createdAt: pedido.createdAt,
                updatedAt: pedido.updatedAt
            }
        });
        
    } catch (error) {
        logError(`Error en upsertPedido: ${error.message}`);
        res.status(500).json({
            error: 'Error al guardar pedido',
            message: error.message
        });
    }
}

/**
 * DELETE /api/pedidos/:productoId/:ano/:mes
 * Eliminar un pedido específico
 */
async function deletePedido(req, res) {
    try {
        const productoId = parseInt(req.params.productoId, 10);
        const ano = parseInt(req.params.ano, 10);
        const mes = parseInt(req.params.mes, 10);
        
        if (isNaN(productoId) || isNaN(ano) || isNaN(mes)) {
            return res.status(400).json({
                error: 'Parámetros inválidos'
            });
        }
        
        const pedido = await prisma.pedido.findUnique({
            where: {
                productoId_ano_mes: {
                    productoId,
                    ano,
                    mes
                }
            }
        });
        
        if (!pedido) {
            return res.status(404).json({
                error: 'Pedido no encontrado'
            });
        }
        
        await prisma.pedido.delete({
            where: {
                productoId_ano_mes: {
                    productoId,
                    ano,
                    mes
                }
            }
        });
        
        res.json({
            message: 'Pedido eliminado exitosamente'
        });
        
    } catch (error) {
        logError(`Error en deletePedido: ${error.message}`);
        res.status(500).json({
            error: 'Error al eliminar pedido',
            message: error.message
        });
    }
}

/**
 * PUT /api/pedidos/:productoId/actual
 * Crear o actualizar pedido para el mes actual
 * Body: { cantidad }
 */
async function upsertPedidoActual(req, res) {
    try {
        const productoId = parseInt(req.params.productoId, 10);
        const { cantidad } = req.body;
        
        if (isNaN(productoId)) {
            return res.status(400).json({
                error: 'ID de producto inválido'
            });
        }
        
        const cantidadNum = parseFloat(cantidad) || 0;
        const mesActual = getMesActual();
        
        // Verificar que el producto existe
        const producto = await prisma.producto.findUnique({
            where: { id: productoId },
            select: { id: true, sku: true, descripcion: true }
        });
        
        if (!producto) {
            return res.status(404).json({
                error: 'Producto no encontrado'
            });
        }
        
        // Crear o actualizar pedido del mes actual
        const pedido = await prisma.pedido.upsert({
            where: {
                productoId_ano_mes: {
                    productoId,
                    ano: mesActual.ano,
                    mes: mesActual.mes
                }
            },
            update: {
                cantidad: cantidadNum
            },
            create: {
                productoId,
                ano: mesActual.ano,
                mes: mesActual.mes,
                cantidad: cantidadNum
            },
            include: {
                producto: {
                    select: {
                        id: true,
                        sku: true,
                        descripcion: true
                    }
                }
            }
        });
        
        res.json({
            message: 'Pedido del mes actual guardado exitosamente',
            pedido: {
                id: pedido.id,
                producto: pedido.producto,
                ano: pedido.ano,
                mes: pedido.mes,
                cantidad: pedido.cantidad,
                createdAt: pedido.createdAt,
                updatedAt: pedido.updatedAt
            }
        });
        
    } catch (error) {
        logError(`Error en upsertPedidoActual: ${error.message}`);
        res.status(500).json({
            error: 'Error al guardar pedido del mes actual',
            message: error.message
        });
    }
}

module.exports = {
    getPedidos,
    getPedidosPorProducto,
    upsertPedido,
    deletePedido,
    upsertPedidoActual
};
