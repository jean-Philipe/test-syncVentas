/**
 * Rutas para rotación de datos
 */

const express = require('express');
const router = express.Router();
const {
    ejecutarRotacionCompleta,
    necesitaRotacion
} = require('../services/rotacionService');
const { logInfo } = require('../utils/logger');

/**
 * POST /api/rotacion/ejecutar
 * Ejecutar rotación manual de datos (mover mes actual a histórico y limpiar datos antiguos)
 */
router.post('/ejecutar', async (req, res) => {
    try {
        logInfo('Rotación manual iniciada desde API');
        const resultado = await ejecutarRotacionCompleta();
        res.json({
            message: 'Rotación ejecutada exitosamente',
            resultado
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error al ejecutar rotación',
            message: error.message
        });
    }
});

/**
 * GET /api/rotacion/verificar
 * Verificar si es necesario rotar datos
 */
router.get('/verificar', async (req, res) => {
    try {
        const necesita = await necesitaRotacion();
        res.json({
            necesitaRotacion: necesita
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error al verificar rotación',
            message: error.message
        });
    }
});

module.exports = router;
