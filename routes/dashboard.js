/**
 * Rutas del Dashboard de Compras
 */

const express = require('express');
const router = express.Router();
const {
    getDashboard,
    saveOrden,
    getSyncStatus
} = require('../controllers/dashboardController');

// GET /api/dashboard?meses=3|6|12&marca=KC
router.get('/', getDashboard);

// POST /api/dashboard/orden
router.post('/orden', saveOrden);

// GET /api/dashboard/sync-status
router.get('/sync-status', getSyncStatus);

module.exports = router;
