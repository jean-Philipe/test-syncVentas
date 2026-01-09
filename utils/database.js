/**
 * Utilidades para conexión a la base de datos
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/ventas.db';

// Crear directorio data si no existe
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;

/**
 * Obtener conexión a la base de datos
 */
function getDatabase() {
    if (!db) {
        db = new Database(DB_PATH);
        // Habilitar foreign keys
        db.pragma('foreign_keys = ON');
    }
    return db;
}

/**
 * Cerrar conexión a la base de datos
 */
function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}

module.exports = {
    getDatabase,
    closeDatabase
};
