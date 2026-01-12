/**
 * Rutas para endpoints de productos
 */

const express = require('express');
const router = express.Router();
const {
    getVentasHistoricas,
    getVentasActuales,
    getProductosCompleto
} = require('../controllers/productosController');

// GET /api/productos/ventas-historicas?meses=12&marca=KC
router.get('/ventas-historicas', getVentasHistoricas);

// GET /api/productos/ventas-actuales?marca=KC
router.get('/ventas-actuales', getVentasActuales);

// GET /api/productos/completo?meses=12&marca=KC
router.get('/completo', getProductosCompleto);

module.exports = router;
