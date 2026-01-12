/**
 * Rutas para endpoints de pedidos
 */

const express = require('express');
const router = express.Router();
const {
    getPedidos,
    getPedidosPorProducto,
    upsertPedido,
    deletePedido,
    upsertPedidoActual
} = require('../controllers/pedidosController');

// GET /api/pedidos?productoId=1&ano=2026&mes=1&marca=KC
router.get('/', getPedidos);

// GET /api/pedidos/:productoId
router.get('/:productoId', getPedidosPorProducto);

// PUT /api/pedidos/:productoId/actual
router.put('/:productoId/actual', upsertPedidoActual);

// PUT /api/pedidos/:productoId
router.put('/:productoId', upsertPedido);

// DELETE /api/pedidos/:productoId/:ano/:mes
router.delete('/:productoId/:ano/:mes', deletePedido);

module.exports = router;
