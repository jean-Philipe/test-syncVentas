/**
 * Script para inicializar la base de datos
 * Crea las tablas necesarias para productos y ventas mensuales
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/ventas.db';

// Crear directorio data si no existe
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`📁 Directorio creado: ${dataDir}`);
}

// Conectar a la base de datos
const db = new Database(DB_PATH);
console.log(`✅ Conectado a la base de datos: ${DB_PATH}\n`);

// Crear tablas
db.exec(`
    CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        descripcion TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ventas_mensuales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL,
        ano INTEGER NOT NULL,
        mes INTEGER NOT NULL,
        cantidad_vendida REAL DEFAULT 0,
        monto_neto REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(producto_id, ano, mes),
        FOREIGN KEY (producto_id) REFERENCES productos(id)
    );

    CREATE INDEX IF NOT EXISTS idx_ventas_producto ON ventas_mensuales(producto_id);
    CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas_mensuales(ano, mes);
    CREATE INDEX IF NOT EXISTS idx_productos_sku ON productos(sku);
`);

console.log('✅ Tablas creadas exitosamente:');
console.log('   - productos');
console.log('   - ventas_mensuales');
console.log('   - Índices creados\n');

// Verificar tablas
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('📊 Tablas en la base de datos:');
tables.forEach(table => {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
    console.log(`   - ${table.name}: ${count.count} registros`);
});

db.close();
console.log('\n✅ Base de datos inicializada correctamente\n');
