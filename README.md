# Sistema de Gesti?n de Ventas - AXAM

Este sistema permite:
1. **Mapear productos** desde Manager+ a una base de datos local (SKU y descripci?n)
2. **Calcular ventas mensuales** desde Facturas de Venta Electr?nica (FAVE) desde enero 2025

## Instalaci?n

```bash
npm install
```

## Configuraci?n

1. Copia el archivo `env.example` a `.env`
2. Configura las credenciales de Manager+ en `.env`

```bash
cp env.example .env
```

Luego edita el archivo `.env` y configura:
- `ERP_BASE_URL`: URL base de la API de Manager+ (por defecto: https://axam.managermas.cl/api)
- `ERP_USERNAME`: Usuario para autenticaci?n en Manager+
- `ERP_PASSWORD`: Contrase?a para autenticaci?n en Manager+
- `RUT_EMPRESA`: RUT de la empresa (formato: 12345678-9)
- `DB_PATH`: Ruta donde se guardar? la base de datos SQLite (por defecto: ./data/ventas.db)

## Uso

### Inicializar Base de Datos

```bash
npm run init:db
```

### Sincronizar Productos

Obtiene todos los productos de Manager+ y los guarda en la base de datos:

```bash
npm run sync:productos
```

### Sincronizar Ventas

Obtiene todas las FAVEs desde enero 2025, calcula las ventas por producto y mes, y las guarda en la base de datos:

```bash
npm run sync:ventas
```

### Ejecutar Todo

Ejecuta ambos scripts en secuencia:

```bash
npm start
```

### Consultar Ventas

Consulta los datos de ventas guardados en la base de datos:

```bash
# Resumen de ventas por mes
npm run consultar resumen

# Ventas de un producto espec?fico
npm run consultar producto <SKU>

# Top productos por ventas
npm run consultar top [limite]
```

### Test de FAVE

Script de prueba para inspeccionar la estructura de una FAVE y diagnosticar problemas de extracción:

```bash
npm run test:fave
```

Este script:
- Obtiene una FAVE de ejemplo de los últimos 7 días
- Muestra la estructura completa de la FAVE
- Intenta extraer productos y muestra logs detallados
- Ayuda a identificar por qué no se están extrayendo productos correctamente

## Estructura de Base de Datos

### Tabla: productos
- `id`: INTEGER PRIMARY KEY
- `sku`: TEXT UNIQUE (C?digo del producto)
- `descripcion`: TEXT (Descripci?n del producto)
- `created_at`: TEXT (Fecha de creaci?n)
- `updated_at`: TEXT (Fecha de actualizaci?n)

### Tabla: ventas_mensuales
- `id`: INTEGER PRIMARY KEY
- `producto_id`: INTEGER (FK a productos)
- `ano`: INTEGER (A?o de la venta)
- `mes`: INTEGER (Mes de la venta, 1-12)
- `cantidad_vendida`: REAL (Cantidad total vendida en el mes)
- `monto_neto`: REAL (Monto neto total en CLP)
- `created_at`: TEXT (Fecha de creaci?n)
- `updated_at`: TEXT (Fecha de actualizaci?n)
- UNIQUE(producto_id, ano, mes)

## Logs

Los scripts generan logs detallados en la consola mostrando:
- Progreso de sincronizaci?n
- Productos procesados
- FAVEs procesadas
- Errores y advertencias
