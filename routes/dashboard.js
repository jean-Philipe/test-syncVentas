/**
 * Rutas del Dashboard de Compras
 */

const express = require('express');
const router = express.Router();
const {
    getDashboard,
    saveOrden,
    resetOrdenes,
    getSyncStatus,
    getSyncHistory,
    syncStream
} = require('../controllers/dashboardController');

// GET /api/dashboard?meses=3|6|12&marca=KC
router.get('/', getDashboard);

// POST /api/dashboard/orden
router.post('/orden', saveOrden);

// DELETE /api/dashboard/orden/reset - Resetear todas las órdenes del mes
router.delete('/orden/reset', resetOrdenes);

// GET /api/dashboard/sync-stream - Stream SSE para sincronización
router.get('/sync-stream', syncStream);

// GET /api/dashboard/sync-status
router.get('/sync-status', getSyncStatus);

// GET /api/dashboard/sync-history - Historial de sincronizaciones
router.get('/sync-history', getSyncHistory);

module.exports = router;
