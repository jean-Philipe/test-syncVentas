/**
 * Servidor Express para la API de órdenes de compra
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { logInfo, logSuccess, logError } = require('./utils/logger');
const { necesitaRotacion, ejecutarRotacionCompleta } = require('./services/rotacionService');
const { syncYesterday } = require('./scripts/syncDaily');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de logging (antes de las rutas)
app.use((req, res, next) => {
    logInfo(`${req.method} ${req.path}`);
    next();
});

// Rutas de API (deben ir antes de los archivos estáticos)
const productosRoutes = require('./routes/productos');
const pedidosRoutes = require('./routes/pedidos');
const rotacionRoutes = require('./routes/rotacion');
const dashboardRoutes = require('./routes/dashboard');

app.use('/api/productos', productosRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/rotacion', rotacionRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Servir archivos estáticos del frontend (después de las rutas de API)
app.use(express.static('public'));

// Ruta de salud
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// Ruta raíz
app.get('/', (req, res) => {
    res.json({
        message: 'API de Órdenes de Compra - AXAM',
        version: '1.0.0',
        endpoints: {
            productos: {
                ventasHistoricas: 'GET /api/productos/ventas-historicas?meses=12&marca=KC',
                ventasActuales: 'GET /api/productos/ventas-actuales?marca=KC',
                completo: 'GET /api/productos/completo?meses=12&marca=KC'
            },
            pedidos: {
                listar: 'GET /api/pedidos?productoId=1&ano=2026&mes=1&marca=KC',
                porProducto: 'GET /api/pedidos/:productoId',
                crearActualizar: 'PUT /api/pedidos/:productoId',
                crearActualizarActual: 'PUT /api/pedidos/:productoId/actual',
                eliminar: 'DELETE /api/pedidos/:productoId/:ano/:mes'
            },
            rotacion: {
                ejecutar: 'POST /api/rotacion/ejecutar',
                verificar: 'GET /api/rotacion/verificar'
            }
        }
    });
});

// Manejo de errores
app.use((err, req, res, next) => {
    logError(`Error no manejado: ${err.message}`);
    res.status(err.status || 500).json({
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Error interno'
    });
});

// Verificar y ejecutar rotación al iniciar (si es necesario)
async function verificarRotacionInicial() {
    try {
        const necesita = await necesitaRotacion();
        if (necesita) {
            logInfo('Se detectó cambio de mes, ejecutando rotación automática...');
            await ejecutarRotacionCompleta();
            logSuccess('Rotación automática completada');
        }
    } catch (error) {
        logError(`Error en rotación inicial: ${error.message}`);
        // No detener el servidor si falla la rotación inicial
    }
}

// Iniciar servidor
async function startServer() {
    try {
        // Verificar rotación antes de iniciar
        await verificarRotacionInicial();

        // Programar sincronización diaria a las 01:00 AM
        cron.schedule('0 1 * * *', async () => {
            logInfo('⏰ Ejecutando sincronización diaria programada (01:00 AM)...');
            try {
                await syncYesterday();
                logSuccess('✅ Sincronización diaria programada completada');
            } catch (error) {
                logError(`❌ Error en sincronización diaria programada: ${error.message}`);
            }
        });

        logInfo('🕒 Tarea CRON programada: Sincronización diaria a las 01:00 AM');

        app.listen(PORT, () => {
            logSuccess(`🚀 Servidor iniciado en http://localhost:${PORT}`);
            logInfo(`📊 API de Órdenes de Compra - AXAM`);
            logInfo(`   Endpoints disponibles en http://localhost:${PORT}/`);
        });
    } catch (error) {
        logError(`Error al iniciar servidor: ${error.message}`);
        process.exit(1);
    }
}

// Manejar cierre graceful
process.on('SIGTERM', async () => {
    logInfo('SIGTERM recibido, cerrando servidor...');
    process.exit(0);
});

process.on('SIGINT', async () => {
    logInfo('SIGINT recibido, cerrando servidor...');
    process.exit(0);
});

// Iniciar
if (require.main === module) {
    startServer();
}

module.exports = app;
